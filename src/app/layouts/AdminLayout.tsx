import { LayoutDashboard, Users, UserCog, UserPlus, BookOpen, ClipboardList, ShieldCheck, CreditCard, ClipboardCheck, FileText, Award, MessageSquare, LifeBuoy, Globe, Settings, ScrollText, BrainCircuit } from 'lucide-react';
import { Shell, type NavItem } from './Shell';

const items: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true, primary: true },
  { label: 'Students', to: '/admin/students', icon: Users, primary: true },
  { label: 'Staff', to: '/admin/staff', icon: UserPlus },
  { label: 'Trainers', to: '/admin/trainers', icon: UserCog },
  { label: 'Courses', to: '/admin/courses', icon: BookOpen },
  { label: 'AI Training', to: '/admin/ai-training', icon: BrainCircuit },
  { label: 'Enrollments', to: '/admin/enrollments', icon: ClipboardList },
  { label: 'Identity', to: '/admin/identity', icon: ShieldCheck },
  { label: 'Payments', to: '/admin/payments', icon: CreditCard, primary: true },
  { label: 'Assessments', to: '/admin/assessments', icon: ClipboardCheck },
  { label: 'Examinations', to: '/admin/exams', icon: FileText },
  { label: 'Certificates', to: '/admin/certificates', icon: Award },
  { label: 'Discussions', to: '/admin/discussions', icon: MessageSquare },
  { label: 'Support', to: '/admin/support', icon: LifeBuoy, primary: true },
  { label: 'Website', to: '/admin/content', icon: Globe },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
  { label: 'Audit log', to: '/admin/audit', icon: ScrollText },
];

export default function AdminLayout() {
  return <Shell items={items} areaLabel="Admin" areaTone="admin" basePath="/admin" />;
}
