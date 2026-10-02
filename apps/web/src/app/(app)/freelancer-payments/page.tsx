// Old freelancer payments screen — replaced by the freelancer directory + payments ledger.
import { redirect } from 'next/navigation';

export default function FreelancerPaymentsRedirect() {
  redirect('/freelancers');
}
