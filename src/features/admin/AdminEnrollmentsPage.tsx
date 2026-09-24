import TrainerStudentsPage from '@/features/trainer/TrainerStudentsPage';

/** Admin view of all enrollments – same responsive table as trainers, unrestricted by RLS. */
export default function AdminEnrollmentsPage() {
  return <TrainerStudentsPage />;
}
