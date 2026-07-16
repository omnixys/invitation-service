import { PrismaClient, InvitationStatus } from '../src/prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const totalInvitations = await prisma.invitation.count();
  const approvedInvitations = await prisma.invitation.count({
    where: { status: InvitationStatus.APPROVED },
  });
  const plusOnes = await prisma.invitation.count({
    where: { invitedByInvitationId: { not: null } },
  });

  const result = {
    service: 'invitation',
    checks: [
      { name: 'Invitations', ok: totalInvitations > 0, count: totalInvitations },
      { name: 'Approved Invitations', ok: approvedInvitations > 0, count: approvedInvitations },
      { name: 'Plus-Ones', ok: plusOnes > 0, count: plusOnes },
    ],
  };

  console.log('VALIDATE_JSON:' + JSON.stringify(result));
}

main()
  .catch((e) => {
    console.error('❌ Validate failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
