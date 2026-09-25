import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const signIn = vi.fn();
const resendVerification = vi.fn();
vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ signIn, configured: true, resendVerification }),
}));

import LoginPage from './LoginPage';

function renderAt(path = '/login', state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<p>student home</p>} />
        <Route path="/app/lessons/abc" element={<p>lesson page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    signIn.mockReset();
    resendVerification.mockReset();
  });

  it('shows a friendly error for wrong credentials and offers to resend verification when unconfirmed', async () => {
    const user = userEvent.setup();
    signIn.mockRejectedValueOnce(new Error('Invalid login credentials'));
    renderAt();
    await user.type(screen.getByLabelText(/e-mail/i), 'a@b.test');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/incorrect e-mail or password/i)).toBeInTheDocument();

    signIn.mockRejectedValueOnce(new Error('Email not confirmed'));
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText(/confirm your e-mail/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /resend verification/i }));
    expect(resendVerification).toHaveBeenCalledWith('a@b.test', undefined); // no captcha token when Turnstile is off
  });

  it('does not force a successful login into the student app', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValueOnce(undefined);
    renderAt();
    await user.type(screen.getByLabelText(/e-mail/i), 'admin@mcsli.org');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(signIn).toHaveBeenCalled();
    expect(screen.queryByText('student home')).not.toBeInTheDocument();
  });

  it('returns the user to the page they wanted after login', async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValueOnce(undefined);
    renderAt('/login', { from: '/app/lessons/abc' });
    await user.type(screen.getByLabelText(/e-mail/i), 'a@b.test');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('lesson page')).toBeInTheDocument();
  });
});
