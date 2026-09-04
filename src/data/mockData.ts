import {colors} from '../theme/colors.ts';

export const feedPosts = [
  {
    id: '1',
    author: "Registrar's Office",
    authorId: 'u1',
    avatar: '',
    time: '2 hours ago',
    tag: 'ANNOUNCEMENTS',
    title: '2023/2024 Matriculation Ceremony Update',
    body: 'The university management wishes to inform all fresh students that the...',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800',
    likes: '1.2k',
    comments: 84,
  },
  {
    id: '2',
    author: 'Debby Vibes',
    authorId: 'u2',
    avatar: '',
    time: '5 hours ago',
    tag: 'CAMPUS LIFE',
    title: 'Finding the Best Jollof on Campus! 🍚',
    body: "I went on a mission to rank all the cafeterias in Ikire Campus. You won't...",
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    likes: '432',
    comments: 156,
  },
  {
    id: '3',
    author: 'SUG Official',
    authorId: 'u3',
    avatar: '',
    time: 'Yesterday',
    tag: 'EVENTS',
    title: 'Tech-Ignite: Hackathon 2024',
    body: 'Calling all developers, designers, and innovators! Join us for a 48-hour sprint ...',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800',
    likes: '890',
    comments: 24,
  },
];

export const users = {
  u1: {
    id: 'u1',
    name: "Registrar's Office",
    handle: '@registrar',
    avatar: '',
    followers: 12400,
    following: 12,
    bio: 'Official announcements from the Registrar office.',
  },
  u2: {
    id: 'u2',
    name: 'Debby Vibes',
    handle: '@debby_vibes',
    avatar: '',
    followers: 842,
    following: 186,
    bio: 'Campus lifestyle reviewer. Jollof connoisseur.',
  },
  u3: {
    id: 'u3',
    name: 'SUG Official',
    handle: '@sug_uniosun',
    avatar: '',
    followers: 5630,
    following: 34,
    bio: 'Student Union Government official page.',
  },
} as const;

export const suggestedFollows = [
  {
    id: 's1',
    name: 'Student Union',
    handle: '@sug_uniosun',
    avatar: '',
  },
  {
    id: 's2',
    name: 'Official News',
    handle: '@uniosun_hq',
    avatar: '',
  },
];

export const interests = [
  {
    id: 'i1',
    title: 'Tech Events',
    description: 'Hackathons, workshops, and GDSC updates.',
    badge: '3 New Updates',
    icon: 'monitor',
    iconColor: colors.interestBlue,
    iconBg: colors.interestBlueBg,
  },
  {
    id: 'i2',
    title: 'Academic Politics',
    description: 'SUG manifestos and faculty council news.',
    badge: 'Trending',
    icon: 'award',
    iconColor: colors.interestGreen,
    iconBg: colors.interestGreenBg,
  },
];

export const postCategories = [
  'Announcements',
  'Academics',
  'Campus Life',
  'Opinion',
  'Events',
];
