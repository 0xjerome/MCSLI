import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Certificate } from '@/types/database';
import { SITE_URL } from '@/lib/seo';

export interface CertificateSettings {
  signatory_name?: string;
  signatory_title?: string;
  issuer?: string;
  footer_note?: string;
}

/**
 * Renders the certificate PDF in the browser from the server-issued certificate record.
 * The certificate's authority comes from its number + the public verification page, not from the file.
 */
export async function buildCertificatePdf(cert: Certificate, settings: CertificateSettings = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${cert.certificate_title} – ${cert.student_name}`);
  pdf.setAuthor(settings.issuer ?? 'Master Class Sign Language Initiative (MCSLI)');
  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const brand = rgb(27 / 255, 90 / 255, 158 / 255);
  const accent = rgb(242 / 255, 118 / 255, 26 / 255);
  const ink = rgb(23 / 255, 30 / 255, 39 / 255);
  const muted = rgb(107 / 255, 122 / 255, 140 / 255);

  // Border
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: brand, borderWidth: 3 });
  page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64, borderColor: accent, borderWidth: 1 });

  // Logo
  try {
    const logoBytes = await fetch('/media/logo.jpg').then((r) => r.arrayBuffer());
    const logo = await pdf.embedJpg(logoBytes);
    const size = 72;
    page.drawImage(logo, { x: width / 2 - size / 2, y: height - 60 - size, width: size, height: size });
  } catch {
    // logo optional
  }

  const center = (text: string, y: number, font: typeof serif, size: number, color = ink) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  center(settings.issuer ?? 'Master Class Sign Language Initiative (MCSLI)', height - 150, sansBold, 12, brand);
  center('Through Sign Language, the Hand Can Speak', height - 166, serifItalic, 11, muted);
  center(cert.certificate_title.toUpperCase(), height - 210, serif, 26, ink);
  center('This certifies that', height - 245, sans, 12, muted);
  center(cert.student_name, height - 285, serif, 34, brand);
  center('has successfully completed', height - 315, sans, 12, muted);
  center(cert.course_title, height - 340, serif, 18, ink);
  const completion = new Date(cert.completion_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  center(`Completed on ${completion}`, height - 365, sans, 11, ink);

  // Signature block
  const sigY = 120;
  page.drawLine({ start: { x: 110, y: sigY }, end: { x: 330, y: sigY }, thickness: 1, color: ink });
  page.drawText(settings.signatory_name || '________________________', { x: 110, y: sigY + 6, size: 11, font: sansBold, color: ink });
  page.drawText(settings.signatory_title ?? 'Founder & Executive Director', { x: 110, y: sigY - 14, size: 9, font: sans, color: muted });
  page.drawText('MCSLI, Kampala, Uganda', { x: 110, y: sigY - 26, size: 9, font: sans, color: muted });

  // QR + number
  const verifyUrl = `${SITE_URL}/certificate/${cert.certificate_number}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 220, errorCorrectionLevel: 'M', color: { dark: '#171E27', light: '#FFFFFF' } });
  const qrBytes = await fetch(qrDataUrl).then((r) => r.arrayBuffer());
  const qr = await pdf.embedPng(qrBytes);
  page.drawImage(qr, { x: width - 110 - 80, y: 80, width: 80, height: 80 });
  page.drawText('Certificate no.', { x: width - 110 - 80, y: 68, size: 8, font: sans, color: muted });
  page.drawText(cert.certificate_number, { x: width - 110 - 80, y: 56, size: 10, font: sansBold, color: ink });
  page.drawText('Scan or visit to verify:', { x: width - 110 - 80, y: 44, size: 7, font: sans, color: muted });
  page.drawText(verifyUrl.replace(/^https?:\/\//, ''), { x: width - 110 - 80, y: 34, size: 7, font: sans, color: brand });

  const issued = new Date(cert.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  center(`Issued ${issued}${settings.footer_note ? ` · ${settings.footer_note.replace('<number>', cert.certificate_number)}` : ''}`, 40, sans, 8, muted);

  return pdf.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
