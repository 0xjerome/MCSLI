import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LockedCard } from './LockedCard';
import { DataTable } from './ui/DataTable';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { mergeContent } from '@/content/useSiteContent';
import { defaultContent } from '@/content/defaults';
import { evaluateMonthAccess } from '@/domain/progression';
import { buildFeeSchedule } from '@/domain/pricing';

describe('LockedCard', () => {
  it('explains every reason and links to the right action', () => {
    const schedule = buildFeeSchedule({ currency: 'UGX', tuitionNational: 350000, tuitionInternational: 400000, registrationFee: 20000, installmentsEnabled: true, installmentCount: 2, installmentDueBeforeMonth: { 2: 2 } }, 'ugandan', 'installments');
    const access = evaluateMonthAccess({ enrollmentStatus: 'active', schedule, confirmedRegistration: 20000, confirmedTuition: 175000, monthNumber: 2, assessmentResults: { 1: 'not_passed' }, overrides: [] });
    render(
      <MemoryRouter>
        <LockedCard title="Month 2" reasons={access.reasons} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('region', { name: /month 2 is locked/i })).toBeInTheDocument();
    expect(screen.getByText(/installment 2 must be confirmed before Month 2/)).toBeInTheDocument();
    expect(screen.getByText(/requires another attempt/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to payments/i })).toHaveAttribute('href', '/app/payments');
  });
});

describe('DataTable', () => {
  const rows = [
    { id: '1', name: 'Aisha', amount: 'UGX 20,000' },
    { id: '2', name: 'Brian', amount: 'UGX 175,000' },
  ];
  it('renders an accessible table for desktop and a card list for mobile', () => {
    render(<DataTable caption="Payments" rows={rows} rowKey={(r) => r.id} columns={[{ key: 'name', header: 'Name', cell: (r) => r.name, primary: true }, { key: 'amount', header: 'Amount', cell: (r) => r.amount }]} />);
    const table = screen.getByRole('table', { name: 'Payments' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    const list = screen.getByRole('list', { name: 'Payments' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getAllByText('Amount')).toHaveLength(2);
  });
  it('shows the empty state when there are no rows', () => {
    render(<DataTable caption="Payments" rows={[]} rowKey={(r: { id: string }) => r.id} columns={[{ key: 'a', header: 'A', cell: () => 'x' }]} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  it('is a modal with a label, closes on Escape and traps focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Confirm">
        <Button>First</Button>
        <Button>Last</Button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe('site content merging', () => {
  it('overrides defaults with valid database rows and ignores invalid ones', () => {
    const merged = mergeContent([
      { key: 'contact', value: { ...defaultContent.contact, phone: '0700000000' } },
      { key: 'impact_stats', value: { stats: 'not-an-array' } },
    ]);
    expect(merged.contact.phone).toBe('0700000000');
    expect(merged.impact_stats).toEqual(defaultContent.impact_stats);
    expect(merged.organisation.registrationNumber).toBe('80034987295030');
  });
  it('hides unverified statistics by default', () => {
    expect(defaultContent.impact_stats.stats.every((s) => !s.verified)).toBe(true);
  });
});
