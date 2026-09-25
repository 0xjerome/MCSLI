import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const signUp = vi.fn();
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ signUp, configured: true, signIn: vi.fn(), resendVerification: vi.fn() }),
}));

import RegisterPage from './RegisterPage';

describe('RegisterPage (multi-step registration)', () => {
  beforeEach(() => signUp.mockReset());

  it('validates each step, shows the nationality-based fees and submits the right payload', async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ needsEmailConfirmation: true });
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    // Step 1 – validation
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/full name/i), 'Aisha Nakato');
    await user.type(screen.getByLabelText(/e-mail address/i), 'aisha@example.test');
    await user.type(screen.getByLabelText(/phone number/i), '+256700000000');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2 – residency drives pricing
    expect(await screen.findByText(/which describes you/i)).toBeInTheDocument();
    expect(screen.getByText(/Tuition UGX 350,000/)).toBeInTheDocument();
    expect(screen.getByText(/Tuition UGX 400,000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/choose one option/i)).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /non-ugandan student/i }));
    await user.type(screen.getByLabelText(/country of residence/i), 'Kenya');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    // Step 3 – password + consent
    await user.type(await screen.findByLabelText(/^password/i), 'StrongPass123');
    await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/must accept the terms/i)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/check your e-mail/i)).toBeInTheDocument();
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'aisha@example.test', fullName: 'Aisha Nakato', nationality: 'international', country: 'Kenya', password: 'StrongPass123' }));
  });

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/full name/i), 'Test Person');
    await user.type(screen.getByLabelText(/e-mail address/i), 't@example.test');
    await user.type(screen.getByLabelText(/phone number/i), '0700000000');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.click(await screen.findByRole('radio', { name: /^ugandan student/i }));
    await user.type(screen.getByLabelText(/country of residence/i), 'Uganda');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    await user.type(await screen.findByLabelText(/^password/i), 'StrongPass123');
    await user.type(screen.getByLabelText(/confirm password/i), 'Different123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
});
