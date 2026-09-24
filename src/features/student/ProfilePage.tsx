import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Upload, Trash2, FileText, Eye } from 'lucide-react';
import { usePageMeta } from '@/lib/seo';
import { friendlyError } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthProvider';
import { updateMyProfile } from '@/services/student';
import { getMyIdentity, listMyIdentityDocuments, submitIdentity, uploadIdentityDocument, deleteIdentityDocument, myDocumentUrl } from '@/services/identity';
import { validateUpload } from '@/services/payments';
import { PageHeader } from '@/app/layouts/Shell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Checkbox, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Alert, Skeleton, DescriptionList } from '@/components/ui/Misc';
import { IdentityStatusBadge } from '@/components/StatusBadges';
import { useToast } from '@/components/ui/Toast';
import { formatDate, humanFileSize } from '@/lib/utils';

export default function ProfilePage() {
  const { profile, refreshProfile, role } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  usePageMeta({ title: 'My profile', noIndex: true });

  if (!profile) return <Skeleton className="h-64" />;

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await updateMyProfile({ full_name: String(fd.get('full_name')).trim(), phone: String(fd.get('phone')).trim() || null, country: String(fd.get('country')).trim() || null, city: String(fd.get('city')).trim() || null, bio: String(fd.get('bio')).trim() || null });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not save', friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Account" title="My profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal details" description="Your name is printed on your certificate — keep it exactly as on your ID." />
          <form onSubmit={saveProfile} className="space-y-4">
            <Input name="full_name" label="Full name" defaultValue={profile.full_name} required minLength={3} />
            <Input name="email" label="E-mail" defaultValue={profile.email} disabled hint="Contact support to change your e-mail address." />
            <Input name="phone" label="Phone" type="tel" defaultValue={profile.phone ?? ''} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="country" label="Country" defaultValue={profile.country ?? ''} />
              <Input name="city" label="City / town" defaultValue={profile.city ?? ''} optionalLabel />
            </div>
            <Input label="Student classification" value={profile.nationality === 'ugandan' ? 'Ugandan student' : 'Non-Ugandan student'} disabled hint="Determines your tuition. Contact MCSLI if this is wrong." />
            <Textarea name="bio" label="About you" optionalLabel rows={3} defaultValue={profile.bio ?? ''} hint="Shown to trainers and in discussions." />
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </form>
        </Card>
        {role === 'STUDENT' ? <IdentitySection /> : (
          <Card>
            <CardHeader title="Role" />
            <p className="text-sm text-ink-700">You are signed in as <strong>{role}</strong>.</p>
          </Card>
        )}
      </div>
    </>
  );
}

function IdentitySection() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const identity = useQuery({ queryKey: ['my-identity'], queryFn: getMyIdentity });
  const docs = useQuery({ queryKey: ['my-identity-docs'], queryFn: listMyIdentityDocuments });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadErr, setUploadErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const isUg = profile?.nationality === 'ugandan';
  const status = identity.data?.status ?? 'not_submitted';
  const canSubmit = status === 'not_submitted' || status === 'rejected';

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await submitIdentity({
        docType: isUg ? 'national_id' : (String(fd.get('doc_type')) as 'passport' | 'other'),
        idNumber: String(fd.get('id_number')),
        fullName: String(fd.get('full_name')),
        issuingCountry: String(fd.get('issuing_country')),
        consent: fd.get('consent') === 'on',
      });
      await qc.invalidateQueries({ queryKey: ['my-identity'] });
      toast.success('Identification submitted', 'Now upload a photo or scan of the document.');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || !user) return;
    const v = validateUpload(file);
    if (v) return setUploadErr(v);
    setUploadErr('');
    setBusy(true);
    try {
      await uploadIdentityDocument(user.id, file);
      await qc.invalidateQueries({ queryKey: ['my-identity-docs'] });
      toast.success('Document uploaded', 'MCSLI will verify it shortly.');
    } catch (err) {
      setUploadErr(friendlyError(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this document? You can upload another one.')) return;
    try {
      await deleteIdentityDocument(id);
      await qc.invalidateQueries({ queryKey: ['my-identity-docs'] });
    } catch (err) {
      toast.error('Could not delete', friendlyError(err));
    }
  };

  const preview = async (path: string) => {
    try {
      window.open(await myDocumentUrl(path), '_blank', 'noopener');
    } catch (err) {
      toast.error('Could not open', friendlyError(err));
    }
  };

  return (
    <Card id="identity">
      <CardHeader title="Identity verification" description={isUg ? 'Ugandan students verify with their National ID (NIN).' : 'Non-Ugandan students verify with a passport or other approved identification.'} action={<IdentityStatusBadge status={status} />} />
      {identity.isLoading ? (
        <Skeleton lines={4} />
      ) : (
        <>
          {identity.data && (
            <DescriptionList
              className="mb-5"
              items={[
                { label: 'Document', value: identity.data.doc_type === 'national_id' ? 'National ID (NIN)' : identity.data.doc_type === 'passport' ? 'Passport' : 'Other ID' },
                { label: 'Number', value: <span className="font-mono">{identity.data.id_number_masked}</span> },
                { label: 'Name on document', value: identity.data.full_name_on_document },
                { label: 'Issuing country', value: identity.data.issuing_country },
                { label: 'Submitted', value: formatDate(identity.data.submitted_at) },
                { label: 'Reviewed', value: identity.data.reviewed_at ? formatDate(identity.data.reviewed_at) : 'Pending' },
              ]}
            />
          )}
          {status === 'rejected' && (
            <Alert tone="danger" title="Resubmission required" className="mb-5">
              {identity.data?.rejection_reason ?? 'Please check your details and submit again.'}
            </Alert>
          )}
          {status === 'verified' && (
            <Alert tone="success" className="mb-5" title="Verified">
              Thank you — your identity has been verified by MCSLI.
            </Alert>
          )}

          {canSubmit && (
            <form onSubmit={submit} className="space-y-4">
              {!isUg && (
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink-800">Document type</span>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="doc_type" value="passport" defaultChecked className="h-4 w-4 text-brand-600" /> Passport
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="doc_type" value="other" className="h-4 w-4 text-brand-600" /> Other approved ID
                    </label>
                  </div>
                </div>
              )}
              <Input name="id_number" label={isUg ? 'National Identification Number (NIN)' : 'Document number'} required autoComplete="off" spellCheck={false} hint={isUg ? '14 characters, e.g. CM…' : 'As printed on the document.'} />
              <Input name="full_name" label="Full name as on the document" required defaultValue={profile?.full_name} />
              <Input name="issuing_country" label="Issuing country" required defaultValue={isUg ? 'Uganda' : profile?.country ?? ''} />
              <Checkbox name="consent" required label="I consent to MCSLI storing this identification securely to verify my identity and issue my certificate." description="Stored encrypted-at-rest, masked in the app, and only visible to authorised MCSLI administrators. See the privacy policy." />
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" loading={busy} leftIcon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}>
                Submit identification
              </Button>
            </form>
          )}

          {identity.data && (
            <div className="mt-6 border-t border-ink-200 pt-5">
              <h3 className="font-semibold">Document upload</h3>
              <p className="mt-1 text-sm text-ink-600">Upload a clear photo or scan (JPG, PNG, WEBP or PDF, max 10 MB). Files are private and never at a public link.</p>
              <ul className="mt-3 space-y-2">
                {(docs.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 text-sm">
                    <FileText className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-900">{d.file_name}</span>
                      <span className="text-xs text-ink-500">
                        {humanFileSize(d.size_bytes)} · {formatDate(d.uploaded_at)}
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => preview(d.storage_path)} leftIcon={<Eye className="h-4 w-4" aria-hidden="true" />}>
                      View
                    </Button>
                    {status !== 'verified' && (
                      <Button variant="ghost" size="sm" onClick={() => remove(d.id)} aria-label={`Delete ${d.file_name}`}>
                        <Trash2 className="h-4 w-4 text-danger-600" aria-hidden="true" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {status !== 'verified' && (
                <div className="mt-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-4 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                    <Upload className="h-4 w-4" aria-hidden="true" /> {busy ? 'Uploading…' : 'Choose file to upload'}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
                  </label>
                  {uploadErr && <p className="mt-2 text-sm text-danger-700" role="alert">{uploadErr}</p>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
