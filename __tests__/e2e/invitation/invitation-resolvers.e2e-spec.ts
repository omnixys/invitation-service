import type { InvitationCreateInput } from '../../../src/invitation/models/input/create-invitation.input.js';
import type { InvitationPayload } from '../../../src/invitation/models/payloads/invitation.payload.js';
import { AdminWriteService } from '../../../src/invitation/service/invitation-admin.write.service.js';
import { InvitationReadService } from '../../../src/invitation/service/invitation-read.service.js';
import {
  InvitationStatus,
  InvitationType,
} from '../../../src/prisma/generated/client.js';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import { OmnixysLogger } from '@omnixys/logger';

jest.unstable_mockModule('@omnixys/security', () => ({
  CookieAuthGuard: class CookieAuthGuard {},
  CurrentEventId: () => () => undefined,
  CurrentUser: () => () => undefined,
  CurrentUserData: class CurrentUserData {},
  EventAccessDeniedException: class EventAccessDeniedException extends Error {},
  EventRoleGuard: class EventRoleGuard {
    canActivate(): boolean {
      return true;
    }
  },
  EventRoleResolver: class EventRoleResolver {},
  EventRoles: () => () => undefined,
  RoleGuard: class RoleGuard {
    canActivate(): boolean {
      return true;
    }
  },
  Roles: () => () => undefined,
  extractEventId: () => undefined,
  isOwnerOrEventAdmin: () => true,
}));

let AdminMutationResolverClass: typeof import('../../../src/invitation/resolver/invitation-admin-mutation.resolver.js').AdminMutationResolver;
let InvitationQueryResolverClass: typeof import('../../../src/invitation/resolver/invitation-query.resolver.js').InvitationQueryResolver;

beforeAll(async () => {
  ({ AdminMutationResolver: AdminMutationResolverClass } =
    await import('../../../src/invitation/resolver/invitation-admin-mutation.resolver.js'));
  ({ InvitationQueryResolver: InvitationQueryResolverClass } =
    await import('../../../src/invitation/resolver/invitation-query.resolver.js'));
});

type AdminServiceMock = {
  create: jest.Mock;
  importInvitations: jest.Mock;
  approve: jest.Mock;
  delete: jest.Mock;
  bulkApprove: jest.Mock;
};

type ReadServiceMock = {
  findAll: jest.Mock;
  findByEventId: jest.Mock;
  findFullByEventIds: jest.Mock;
  findOne: jest.Mock;
  findByUser: jest.Mock;
  findPlusOnesByInvitation: jest.Mock;
};

function payload(
  overrides: Partial<InvitationPayload> = {},
): InvitationPayload {
  return {
    id: 'invitation-1',
    type: InvitationType.PRIVATE,
    firstName: 'Ada',
    lastName: 'Lovelace',
    eventId: 'event-1',
    autoApproveOnAccept: false,
    status: InvitationStatus.PENDING,
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
    maxInvitees: 0,
    selectedInvitedBy: [],
    guestNote: undefined,
    plusOneAgeCategory: undefined,
    ...overrides,
  };
}

function loggerMock(): Pick<OmnixysLogger, 'log'> {
  return {
    log: jest.fn().mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  };
}

function adminServiceMock(): AdminServiceMock {
  return {
    create: jest.fn(),
    importInvitations: jest.fn(),
    approve: jest.fn(),
    delete: jest.fn(),
    bulkApprove: jest.fn(),
  };
}

function readServiceMock(): ReadServiceMock {
  return {
    findAll: jest.fn(),
    findByEventId: jest.fn(),
    findFullByEventIds: jest.fn(),
    findOne: jest.fn(),
    findByUser: jest.fn(),
    findPlusOnesByInvitation: jest.fn(),
  };
}

describe('AdminMutationResolver integration', () => {
  let moduleRef: TestingModule;
  let resolver: InstanceType<typeof AdminMutationResolverClass>;
  let service: AdminServiceMock;

  beforeEach(async () => {
    service = adminServiceMock();
    moduleRef = await Test.createTestingModule({
      providers: [
        AdminMutationResolverClass,
        { provide: AdminWriteService, useValue: service },
        { provide: OmnixysLogger, useValue: loggerMock() },
      ],
    }).compile();
    resolver = moduleRef.get(AdminMutationResolverClass);
  });

  afterEach(async () => moduleRef.close());

  it('delegates invitation creation with the authenticated actor', async () => {
    const input = {
      eventId: 'event-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      maxInvitees: 0,
    } as InvitationCreateInput;
    const result = payload();
    service.create.mockResolvedValue(result);

    await expect(
      resolver.createInvitation(input, { id: 'actor-1' }),
    ).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(input, 'actor-1');
  });

  it('delegates invitation creation with any actor id', async () => {
    service.create.mockResolvedValue(payload());

    await expect(
      resolver.createInvitation({} as InvitationCreateInput, { id: '' }),
    ).resolves.toEqual(payload());
    expect(service.create).toHaveBeenCalledWith({}, '');
  });

  it('maps approval input and actor to the write service', async () => {
    const result = payload({ status: InvitationStatus.APPROVED });
    service.approve.mockResolvedValue(result);
    const eventEndsAt = new Date('2030-01-01T00:00:00.000Z');

    await expect(
      resolver.approveInvitation(
        {
          invitationId: 'invitation-1',
          approved: true,
          eventName: 'Platform Launch',
          eventEndsAt,
          seat: 'A-1',
        },
        'event-1',
        { id: 'admin-1' },
      ),
    ).resolves.toBe(result);
    expect(service.approve).toHaveBeenCalledWith({
      id: 'invitation-1',
      approve: true,
      actorId: 'admin-1',
      eventName: 'Platform Launch',
      eventEndsAt,
      seat: 'A-1',
      seatId: undefined,
      activeEventId: 'event-1',
    });
  });

  it('passes active event context to delete and bulk approval', async () => {
    service.delete.mockResolvedValue(true);
    service.bulkApprove.mockResolvedValue([payload({ status: InvitationStatus.APPROVED })]);
    const eventEndsAt = new Date('2030-01-01T00:00:00.000Z');

    await expect(
      resolver.removeInvitation('invitation-1', 'event-1', { id: 'admin-1' }),
    ).resolves.toEqual({
      ok: true,
      message: "Einladung 'invitation-1' Gelöscht",
    });

    await expect(
      resolver.bulkApproveInvitations(
        {
          approved: true,
          invitationIds: [
            {
              invitationId: 'invitation-1',
              eventName: 'Platform Launch',
              seat: 'A-1',
            },
          ],
        },
        eventEndsAt,
        'event-1',
        { id: 'admin-1' },
      ),
    ).resolves.toHaveLength(1);

    expect(service.delete).toHaveBeenCalledWith('invitation-1', 'admin-1', 'event-1');
    expect(service.bulkApprove).toHaveBeenCalledWith({
      invitationIds: [
        {
          invitationId: 'invitation-1',
          eventName: 'Platform Launch',
          seat: 'A-1',
        },
      ],
      approved: true,
      actorId: 'admin-1',
      eventEndsAt,
      activeEventId: 'event-1',
    });
  });
});

describe('InvitationQueryResolver integration', () => {
  let moduleRef: TestingModule;
  let resolver: InstanceType<typeof InvitationQueryResolverClass>;
  let service: ReadServiceMock;

  beforeEach(async () => {
    service = readServiceMock();
    moduleRef = await Test.createTestingModule({
      providers: [
        InvitationQueryResolverClass,
        { provide: InvitationReadService, useValue: service },
      ],
    }).compile();
    resolver = moduleRef.get(InvitationQueryResolverClass);
  });

  afterEach(async () => moduleRef.close());

  it('delegates event-scoped reads without changing the identifier', async () => {
    const result = [payload()];
    service.findByEventId.mockResolvedValue(result);

    await expect(resolver.getByEventId('event-1')).resolves.toBe(result);
    expect(service.findByEventId).toHaveBeenCalledWith('event-1');
  });

  it('delegates authenticated invitation reads with the canonical user ID', async () => {
    const result = [payload()];
    service.findByUser.mockResolvedValue(result);

    await expect(resolver.getMyInvitations({ id: 'user-1' })).resolves.toBe(
      result,
    );
    expect(service.findByUser).toHaveBeenCalledWith('user-1');
  });
});
