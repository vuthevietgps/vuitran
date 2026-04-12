import { Model, Types } from 'mongoose';
import { TicketDocument, TicketStatus } from './schemas/ticket.schema';

export async function buildSlaMetrics(
  ticketModel: Model<TicketDocument>,
  fromDate?: string,
  toDate?: string,
) {
  const dateFilter: any = {};
  if (fromDate) dateFilter.$gte = new Date(fromDate);
  if (toDate) dateFilter.$lte = new Date(toDate);
  const hasDate = Object.keys(dateFilter).length > 0;

  const filter: any = {};
  if (hasDate) filter.createdAt = dateFilter;

  const tickets = await ticketModel.find(filter).lean();

  const resolvedTickets = tickets.filter(
    (t: any) => [TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(t.status),
  );

  const resolutionTimes = resolvedTickets.map((t: any) => {
    const created = new Date(t.createdAt).getTime();
    const resolved = new Date(t.resolution?.resolvedAt || t.updatedAt).getTime();
    return (resolved - created) / (1000 * 60 * 60);
  });

  const avgResolutionHours = resolutionTimes.length > 0
    ? Math.round(resolutionTimes.reduce((s, v) => s + v, 0) / resolutionTimes.length * 10) / 10
    : null;

  const ticketsWithDue = resolvedTickets.filter((t: any) => t.dueDate);
  const onTimeCount = ticketsWithDue.filter((t: any) => {
    const resolved = new Date(t.resolution?.resolvedAt || t.updatedAt);
    return resolved <= new Date(t.dueDate);
  }).length;
  const slaCompliance = ticketsWithDue.length > 0
    ? Math.round((onTimeCount / ticketsWithDue.length) * 100)
    : 100;

  const now = new Date();
  const overdueCount = tickets.filter(
    (t: any) =>
      ![TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(t.status) &&
      !!t.dueDate &&
      new Date(t.dueDate) < now,
  ).length;
  const overdueRate = tickets.length > 0 ? Math.round((overdueCount / tickets.length) * 100) : 0;

  const byPriority: Record<string, number> = {};
  for (const t of tickets) {
    const p = (t as any).priority || 'MEDIUM';
    byPriority[p] = (byPriority[p] || 0) + 1;
  }

  const byStatus: Record<string, number> = {};
  for (const t of tickets) {
    byStatus[(t as any).status] = (byStatus[(t as any).status] || 0) + 1;
  }

  const assigneeCounts: Record<string, number> = {};
  for (const t of resolvedTickets) {
    const aid = (t as any).assignedTo?.toString();
    if (!aid) continue;
    assigneeCounts[aid] = (assigneeCounts[aid] || 0) + 1;
  }

  const assigneeIds = Object.keys(assigneeCounts)
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const userRows = assigneeIds.length > 0
    ? await ticketModel.db.collection('users').find(
      { _id: { $in: assigneeIds } },
      { projection: { fullName: 1 } },
    ).toArray()
    : [];
  const userNameById: Record<string, string> = {};
  for (const u of userRows as any[]) {
    userNameById[u._id.toString()] = u.fullName || u._id.toString();
  }

  const topAssignees = Object.entries(assigneeCounts)
    .map(([id, count]) => ({
      name: userNameById[id] || id,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: tickets.length,
    resolved: resolvedTickets.length,
    avgResolutionHours,
    slaCompliance,
    overdueCount,
    overdueRate,
    byPriority,
    byStatus,
    topAssignees,
  };
}
