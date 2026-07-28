'use client';

import { useActiveProfile } from '@/components/providers/active-profile-provider';
import { UploadForm } from '@/components/upload-form';
import { Alert, ButtonLink, Card, PageHead, t } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function UploadPage() {
  const { profile, isLoaded } = useActiveProfile();
  const isAdmin = profile?.role === 'admin';

  if (!isLoaded) {
    return (
      <div className={`flex min-h-[60vh] items-center justify-center ${t.body}`} role="status">
        Checking permissions...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Alert tone="attention" title="Admin access required">
          Only administrators can upload new PDFs. If you believe this is a mistake, please contact AbdelRahman.
        </Alert>
        <ButtonLink variant="secondary" href="/data-extraction">
          Back to data extraction
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHead
        eyebrow="Upload"
        title="Stage a new study PDF"
        description="Drop in the source document. Title, DOI, and other metadata will be auto-extracted once processing kicks off."
        actions={
          <ButtonLink variant="secondary" href="/data-extraction">
            Back to data extraction
          </ButtonLink>
        }
      />

      <Card>
        <UploadForm />
      </Card>
    </div>
  );
}
