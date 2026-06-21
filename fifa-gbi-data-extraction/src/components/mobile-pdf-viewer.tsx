'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';

type MobilePdfViewerProps = {
  src: string;
  title: string;
};

type PageMetrics = {
  pageNumber: number;
  baseWidth: number;
  baseHeight: number;
  renderScale: number;
};

type PinchGesture = {
  originX: number;
  originY: number;
  midpointX: number;
  midpointY: number;
  startDistance: number;
  startZoom: number;
};

const PAGE_GAP = 12;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const RENDER_QUALITY = 2;

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export function MobilePdfViewer({ src, title }: MobilePdfViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const renderTasksRef = useRef(new Map<number, RenderTask>());
  const pinchRef = useRef<PinchGesture | null>(null);
  const zoomRef = useRef(1);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageMetrics, setPageMetrics] = useState<PageMetrics[]>([]);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    setZoom(1);
    setErrorMessage(null);
    setPageMetrics([]);
    setPdfDocument(null);

    let disposed = false;
    let loadingTask: ReturnType<typeof getDocument> | null = null;

    (async () => {
      try {
        const response = await fetch(src, { cache: 'no-store', credentials: 'same-origin' });
        if (!response.ok) {
          throw new Error(`PDF request failed with ${response.status}`);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        loadingTask = getDocument({ data: bytes });
        const nextDocument = await loadingTask.promise;
        if (disposed) {
          return;
        }
        setPdfDocument(nextDocument);
      } catch (error) {
        if (!disposed) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load PDF');
        }
      }
    })();

    return () => {
      disposed = true;
      void loadingTask?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setAvailableWidth(Math.max(Math.floor(nextWidth), 0));
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfDocument || availableWidth <= 0) return;

    let cancelled = false;

    (async () => {
      const nextMetrics: PageMetrics[] = [];
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const fitScale = availableWidth / viewport.width;
        nextMetrics.push({
          pageNumber,
          baseWidth: availableWidth,
          baseHeight: viewport.height * fitScale,
          renderScale: fitScale * RENDER_QUALITY,
        });
      }

      if (!cancelled) {
        setPageMetrics(nextMetrics);
      }
    })().catch((error) => {
      if (!cancelled) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to prepare PDF pages');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [availableWidth, pdfDocument]);

  useEffect(() => {
    if (!pdfDocument || pageMetrics.length === 0) return;

    let cancelled = false;
    const renderTasks = renderTasksRef.current;

    (async () => {
      for (const metrics of pageMetrics) {
        const canvas = canvasRefs.current.get(metrics.pageNumber);
        if (!canvas) continue;

        const page = await pdfDocument.getPage(metrics.pageNumber);
        const viewport = page.getViewport({ scale: metrics.renderScale });
        const context = canvas.getContext('2d');
        if (!context) continue;

        renderTasks.get(metrics.pageNumber)?.cancel();
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        renderTasks.set(metrics.pageNumber, renderTask);

        try {
          await renderTask.promise;
        } catch (error) {
          if (!cancelled) {
            throw error;
          }
        } finally {
          renderTasks.delete(metrics.pageNumber);
        }
      }
    })().catch((error) => {
      if (!cancelled) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to render PDF pages');
      }
    });

    return () => {
      cancelled = true;
      renderTasks.forEach((task) => task.cancel());
      renderTasks.clear();
    };
  }, [pageMetrics, pdfDocument]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;

      const midpoint = getMidpoint(event.touches[0], event.touches[1]);
      const bounds = viewport.getBoundingClientRect();
      pinchRef.current = {
        originX: viewport.scrollLeft + midpoint.x - bounds.left,
        originY: viewport.scrollTop + midpoint.y - bounds.top,
        midpointX: midpoint.x - bounds.left,
        midpointY: midpoint.y - bounds.top,
        startDistance: getDistance(event.touches[0], event.touches[1]),
        startZoom: zoomRef.current,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;

      event.preventDefault();
      const distance = getDistance(event.touches[0], event.touches[1]);
      const nextZoom = clamp((distance / pinch.startDistance) * pinch.startZoom, MIN_ZOOM, MAX_ZOOM);
      const ratio = nextZoom / pinch.startZoom;

      setZoom(nextZoom);

      requestAnimationFrame(() => {
        if (!viewportRef.current) return;
        viewportRef.current.scrollLeft = Math.max((pinch.originX * ratio) - pinch.midpointX, 0);
        viewportRef.current.scrollTop = Math.max((pinch.originY * ratio) - pinch.midpointY, 0);
      });
    };

    const handleTouchEnd = () => {
      pinchRef.current = null;
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', handleTouchEnd);
    viewport.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', handleTouchEnd);
      viewport.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  const contentWidth = useMemo(() => (availableWidth > 0 ? availableWidth * zoom : '100%'), [availableWidth, zoom]);

  if (errorMessage) {
    return (
      <div className="grid min-h-[78dvh] place-items-center bg-white p-6 text-center">
        <div className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-900">
          Unable to render the PDF on mobile. {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="h-[78dvh] w-full min-w-0 flex-1 overflow-auto bg-[#eef3f8] px-2 py-2"
      style={{ touchAction: 'pan-x pan-y' }}
      aria-label={title}
    >
      <div
        className="mx-auto flex flex-col items-center"
        style={{
          gap: `${PAGE_GAP}px`,
          width: typeof contentWidth === 'number' ? `${contentWidth}px` : contentWidth,
        }}
      >
        {pageMetrics.length === 0 ? (
          <div className="grid min-h-[74dvh] w-full place-items-center rounded-[1.75rem] border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
            Loading PDF…
          </div>
        ) : (
          pageMetrics.map((metrics) => (
            <div
              key={metrics.pageNumber}
              className="w-full overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
            >
              <canvas
                ref={(node) => {
                  if (node) {
                    canvasRefs.current.set(metrics.pageNumber, node);
                  } else {
                    canvasRefs.current.delete(metrics.pageNumber);
                  }
                }}
                className="block bg-white"
                style={{
                  height: `${metrics.baseHeight * zoom}px`,
                  width: `${metrics.baseWidth * zoom}px`,
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDistance(firstTouch: Touch, secondTouch: Touch) {
  return Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
}

function getMidpoint(firstTouch: Touch, secondTouch: Touch) {
  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2,
  };
}
