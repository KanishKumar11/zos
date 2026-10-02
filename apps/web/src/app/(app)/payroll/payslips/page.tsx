// Payslips now live under My earnings → Payslips.
import { redirect } from 'next/navigation';

export default function MyPayslipsRedirect() {
  redirect('/earnings?tab=payslips');
}
