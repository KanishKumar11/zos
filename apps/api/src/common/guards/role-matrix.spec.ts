// Role matrix — the price-privacy rule as a test. Only the OWNER may reach any endpoint that
// returns commercial money (prices, budgets, invoices, other people's pay). Self-service pay
// endpoints and the client portal are listed explicitly as exceptions.
import 'reflect-metadata';

import { Role } from '@agency/shared';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { PORTAL_ACCESS_KEY } from '../decorators/portal-access.decorator';
import { ClientsController } from '../../modules/clients/clients.controller';
import { CompensationController } from '../../modules/compensation/compensation.controller';
import { ContractsController } from '../../modules/contracts/contracts.controller';
import { DashboardController } from '../../modules/dashboard/dashboard.controller';
import { ExpensesController } from '../../modules/expenses/expenses.controller';
import { FreelancersController } from '../../modules/freelancers/freelancers.controller';
import { IncomeController } from '../../modules/income/income.controller';
import { InvoicesController } from '../../modules/invoices/invoices.controller';
import { MeEarningsController, PayoutsController } from '../../modules/payouts/payouts.controller';
import { PayrollController } from '../../modules/payroll/payroll.controller';
import { PortalAdminController } from '../../modules/portal/portal-admin.controller';
import { ProjectsController } from '../../modules/projects/projects.controller';
import { SowController } from '../../modules/sow/sow.controller';

type Ctor = { prototype: object; name: string };

const STAFF_NON_OWNER = [Role.ADMIN, Role.LEAD, Role.MEMBER, Role.INTERN];

/** Effective roles for a handler: method-level @Roles wins over class-level. Undefined = everyone. */
function rolesFor(ctrl: Ctor, handler: string): Role[] | undefined {
  const fn = (ctrl.prototype as Record<string, unknown>)[handler];
  return (Reflect.getMetadata(ROLES_KEY, fn as object) ?? Reflect.getMetadata(ROLES_KEY, ctrl)) as Role[] | undefined;
}

function handlers(ctrl: Ctor): string[] {
  return Object.getOwnPropertyNames(ctrl.prototype).filter((n) => {
    if (n === 'constructor') return false;
    const fn = (ctrl.prototype as Record<string, unknown>)[n];
    // Only real route handlers carry Nest's path metadata.
    return typeof fn === 'function' && Reflect.getMetadata('path', fn as object) !== undefined;
  });
}

/** Whole controllers where every route deals in money. */
const MONEY_CONTROLLERS: Ctor[] = [
  InvoicesController,
  ContractsController,
  ExpensesController,
  IncomeController,
  PayoutsController,
  FreelancersController,
  CompensationController,
  ClientsController,
  PortalAdminController,
  PayrollController,
  SowController,
];

/** Routes inside those controllers that are deliberately open — each returns no prices or only the caller's own pay. */
const ALLOWED_OPEN: Record<string, string[]> = {
  PayrollController: ['mine', 'pdf'], // own payslips, released only (checked in handler)
  SowController: ['brief'], // team brief text only, project members only (checked in service)
};

/** Money routes inside mixed controllers. */
const MONEY_HANDLERS: [Ctor, string[]][] = [
  [ProjectsController, ['setMemberCost', 'addFreelancer', 'updateFreelancer', 'removeFreelancer', 'projectBalance', 'projectBalances', 'addMilestone', 'updateMilestone', 'removeMilestone']],
  [DashboardController, ['owner', 'ownerCharts', 'ownerCockpit', 'teamEarnings', 'memberStats']],
];

describe('price privacy role matrix', () => {
  for (const ctrl of MONEY_CONTROLLERS) {
    it(`${ctrl.name}: every money route is owner-only`, () => {
      const open = ALLOWED_OPEN[ctrl.name] ?? [];
      const names = handlers(ctrl);
      expect(names.length).toBeGreaterThan(0);
      for (const h of names) {
        if (open.includes(h)) continue;
        const roles = rolesFor(ctrl, h);
        expect({ route: `${ctrl.name}.${h}`, roles }).toEqual({ route: `${ctrl.name}.${h}`, roles: [Role.OWNER] });
      }
    });
  }

  for (const [ctrl, names] of MONEY_HANDLERS) {
    it(`${ctrl.name}: money handlers are owner-only`, () => {
      for (const h of names) {
        const roles = rolesFor(ctrl, h) ?? [];
        for (const r of STAFF_NON_OWNER) expect({ route: `${ctrl.name}.${h}`, [r]: roles.includes(r) }).toEqual({ route: `${ctrl.name}.${h}`, [r]: false });
        expect(roles).toContain(Role.OWNER);
      }
    });
  }

  it('self-service earnings never accept other people — only the caller (no :id param)', () => {
    expect(rolesFor(MeEarningsController, 'earnings')).not.toContain(Role.CLIENT);
    const path = Reflect.getMetadata('path', (MeEarningsController.prototype as unknown as Record<string, unknown>).earnings as object);
    expect(path).toBe('earnings');
  });

  it('no money controller is opened to the client portal', () => {
    for (const ctrl of [...MONEY_CONTROLLERS, ProjectsController, DashboardController]) {
      expect({ ctrl: ctrl.name, portal: Reflect.getMetadata(PORTAL_ACCESS_KEY, ctrl) ?? false }).toEqual({ ctrl: ctrl.name, portal: false });
      for (const h of handlers(ctrl)) {
        const fn = (ctrl.prototype as Record<string, unknown>)[h] as object;
        expect({ route: `${ctrl.name}.${h}`, portal: Reflect.getMetadata(PORTAL_ACCESS_KEY, fn) ?? false }).toEqual({ route: `${ctrl.name}.${h}`, portal: false });
      }
    }
  });
});
