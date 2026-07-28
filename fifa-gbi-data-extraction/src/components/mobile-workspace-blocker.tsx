'use client';

import { ArrowLeft, DeviceMobileCamera } from '@phosphor-icons/react';

import { ButtonLink, Card, EmptyState } from '@/components/ui';
import { useIsMobile } from '@/hooks/use-is-mobile';

type MobileWorkspaceBlockerProps = {
  children: React.ReactNode;
  backHref?: string;
  breakpoint?: number;
};

/**
 * Prevents editing-heavy workspace views from loading on small screens.
 * Displays a friendly message instead of rendering the workspace.
 */
export function MobileWorkspaceBlocker({
  children,
  backHref = '/data-extraction',
  breakpoint = 1024,
}: MobileWorkspaceBlockerProps) {
  const isMobile = useIsMobile(breakpoint);

  if (isMobile) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <Card>
          <EmptyState
            icon={<DeviceMobileCamera weight="fill" />}
            title="Desktop only experience"
            description="The workspace isn't available on mobile. Please switch to a desktop or laptop to continue editing."
            action={
              <ButtonLink variant="primary" href={backHref} icon={<ArrowLeft />}>
                Back to data extraction
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
