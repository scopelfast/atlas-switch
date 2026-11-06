import { getTeamForUser } from '@/lib/db/queries';
import {
  countPendingOrActivatedAdminInvites,
  countTeamAdminMembers,
  getTeamMaxAdminSlots,
} from '@/lib/team/admin-slots';
import { countOccupiedSeats, getTeamMaxSeats } from '@/lib/team/seat-limits';

export async function GET() {
  const team = await getTeamForUser();
  if (!team) {
    return Response.json(null);
  }

  const seatLimit = await getTeamMaxSeats(team.id);
  const seatsUsed = await countOccupiedSeats(team.id);
  const [adminMembers, adminInvites, adminSlotsMax] = await Promise.all([
    countTeamAdminMembers(team.id),
    countPendingOrActivatedAdminInvites(team.id),
    getTeamMaxAdminSlots(team.id),
  ]);
  return Response.json({
    ...team,
    seatLimit,
    seatsUsed,
    taskflowAdminSlotsMax: adminSlotsMax,
    taskflowAdminSlotsUsed: adminMembers + adminInvites,
    taskflowAdminMembers: adminMembers,
    taskflowAdminInvitesPending: adminInvites,
  });
}
