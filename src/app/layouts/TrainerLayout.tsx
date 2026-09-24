import { LayoutDashboard, Users, ClipboardCheck, RotateCcw, ListChecks, FileText, MessageSquare } from 'lucide-react';
import { Shell, type NavItem } from './Shell';

const items: NavItem[] = [
  { label: 'Dashboard', to: '/trainer', icon: LayoutDashboard, end: true, primary: true },
  { label: 'Students', to: '/trainer/students', icon: Users, primary: true },
  { label: 'Assessments', to: '/trainer/assessments', icon: ClipboardCheck, primary: true },
  { label: 'Reassessments', to: '/trainer/reassessments', icon: RotateCcw },
  { label: 'Quiz results', to: '/trainer/quizzes', icon: ListChecks },
  { label: 'Examinations', to: '/trainer/exams', icon: FileText },
  { label: 'Discussions', to: '/trainer/discussions', icon: MessageSquare, primary: true },
];

export default function TrainerLayout() {
  return <Shell items={items} areaLabel="Trainer" areaTone="trainer" basePath="/trainer" />;
}
