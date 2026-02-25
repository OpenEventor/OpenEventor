import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import {
  People as PeopleIcon,
  Leaderboard as LeaderboardIcon,
  GroupWork as GroupWorkIcon,
  Diversity3 as Diversity3Icon,
  MoreHoriz as MoreHorizIcon,
} from '@mui/icons-material';
import { EVENT_TABS } from '../AppBar/AppBar.tsx';

export function BottomNav() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const activeIndex = EVENT_TABS.findIndex((tab) =>
    location.pathname.includes(`/${tab.path}`),
  );

  const iconMap: Record<string, typeof PeopleIcon> = {
    competitors: PeopleIcon,
    splits: LeaderboardIcon,
    groups: GroupWorkIcon,
    teams: Diversity3Icon,
  };

  return (
    <Paper
      sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }}
      elevation={3}
    >
      <BottomNavigation
        value={activeIndex >= 0 ? activeIndex : false}
        onChange={(_, newValue) => {
          if (newValue < EVENT_TABS.length) {
            navigate(`/events/${eventId}/${EVENT_TABS[newValue].path}`);
          }
        }}
        showLabels={false}
      >
        {EVENT_TABS.map((tab) => {
          const Icon = iconMap[tab.path] ?? PeopleIcon;
          return (
            <BottomNavigationAction
              key={tab.path}
              icon={<Icon />}
              label={tab.label}
            />
          );
        })}
        <BottomNavigationAction
          icon={<MoreHorizIcon />}
          label="More"
        />
      </BottomNavigation>
    </Paper>
  );
}
