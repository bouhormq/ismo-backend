import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { getDateWithoutTZOffset } from 'src/utils/functions/date/date.functions';
import { transformObject } from 'src/utils/functions/misc.functions';
import { CreateActionDto } from './dto/create-action.dto';
import { GetAllCompanyActionsDto } from './dto/get-all-company-actions.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { CompanyActionsTableTransformer } from './entities/action.entity';
import { DetailedActionTransformer } from './entities/detailedAction.entity';

@Injectable()
export class ActionsService {
  constructor(private readonly db: DatabaseService) {}

  async create(createActionDto: CreateActionDto) {
    const { companyId, actionType, addedBy, contact, ...rest } =
      createActionDto;

    let actionData = {};

    if ('id' in actionType) actionData = { connect: { id: actionType.id } };
    else if ('name' in actionType && 'color' in actionType)
      actionData = {
        create: { name: actionType.name, color: actionType.color },
      };

    const newAction = await this.db.action.create({
      data: {
        ...rest,
        company: { connect: { id: companyId } },
        ...(contact && { companyContact: { connect: { id: contact.id } } }),
        actionType: actionData,
        addedBy: { connect: { id: addedBy.id } },
      },
    });

    await this.db.company.update({
      where: { id: newAction.companyId },
      data: { updatedAt: new Date() },
    });

    return newAction;
  }

  async getNotifications(
    userId: number,
    query: { date: string; tzOffset: string },
  ) {
    const { date, tzOffset } = query;

    const now = getDateWithoutTZOffset(
      new Date(date).toUTCString(),
      +(+tzOffset),
    );

    const actions = await this.db.action.findMany({
      where: {
        userId,
        isDone: false,
        startDate: { lte: now },
        endDate: { gte: now },
        alarmDate: { not: null },
      },
    });

    return actions;
  }

  async findAll(payload: GetAllCompanyActionsDto) {
    const { key, order, search, companyId } = payload;

    const orderBy: Prisma.ActionOrderByWithRelationInput = {};
    const where: Prisma.ActionWhereInput = {};

    switch (key) {
      case 'actionType':
        orderBy.actionType = { name: order };
        break;
      default:
        orderBy[key] = order;
        break;
    }

    if (search) {
      where.OR = [
        { addedBy: { name: { contains: search, mode: 'insensitive' } } },
        { object: { contains: search, mode: 'insensitive' } },
        { actionType: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const actions = await this.db.action.findMany({
      where: { AND: [{ companyId }, where] },
      orderBy,
      include: {
        actionType: true,
        addedBy: true,
      },
    });

    const count = await this.db.action.count({
      where: { AND: [{ companyId }, where] },
    });

    return {
      data: transformObject(actions, CompanyActionsTableTransformer),
      count,
    };
  }

  async getActionOptions(payload: { companyId?: number }) {
    const res = await Promise.allSettled([
      this.db.actionType.findMany({
        orderBy: { name: 'asc' },
      }),
      this.db.user.findMany({
        orderBy: { name: 'asc' },
      }),
    ]);

    const contacts = await this.db.contact.findMany({
      orderBy: { firstName: 'asc' },
      ...(payload.companyId ? { where: { companyId: payload.companyId } } : {}),
    });

    const [actionTypes, users] = res.map((data) =>
      data.status === 'fulfilled' ? data.value : [],
    );

    return {
      actionTypes: actionTypes.map((actionType) => ({
        value: actionType.id,
        label: actionType.name,
        color: actionType.color,
      })),
      users: users.map(({ id, name }) => ({ value: id, label: name })),
      contacts: contacts.map(({ id, firstName, lastName }) => ({
        value: id,
        label: `${firstName} ${lastName}`,
      })),
    };
  }

  async findOne(id: number) {
    const action = await this.db.action.findUnique({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        isDone: true,
        object: true,
        description: true,
        startDate: true,
        endDate: true,
        alarmDate: true,
        companyContact: {
          select: { id: true, firstName: true, lastName: true },
        },
        actionType: { select: { id: true, name: true, color: true } },
        addedBy: { select: { id: true, name: true } },
        companyId: true,
      },
    });

    return transformObject(action, DetailedActionTransformer);
  }

  async update(id: number, updateActionDto: UpdateActionDto) {
    const {
      companyId: _,
      actionType,
      addedBy,
      contact,
      ...rest
    } = updateActionDto;

    let actionData = {};

    if (actionType)
      if ('id' in actionType) actionData = { connect: { id: actionType.id } };
      else if ('name' in actionType && 'color' in actionType)
        actionData = {
          create: { name: actionType.name, color: actionType.color },
        };

    // const contactExists = contact
    //   ? await this.db.actionContact.findUnique({
    //       where: { id: contact.id },
    //     })
    //   : undefined;

    const updatedAction = await this.db.action.update({
      where: { id },
      data: {
        ...rest,
        actionType: actionData,

        ...(contact && { companyContact: { connect: { id: contact.id } } }),

        // ...(contact && {
        //   contact: contact.id
        //     ? contactExists
        //       ? { connect: { id: contact.id } }
        //       : { create: { name: contact.name } }
        //     : { create: { name: contact.name } },
        // }),

        ...(addedBy && { addedBy: { connect: { id: addedBy.id } } }),
      },
      include: {
        actionType: true,
        addedBy: true,
        companyContact: true,
      },
    });

    await this.db.company.update({
      where: { id: updatedAction.companyId },
      data: { updatedAt: new Date() },
    });

    return transformObject(updatedAction, DetailedActionTransformer);
  }

  async remove(id: number) {
    const action = await this.db.action.findUnique({
      where: { id },
      select: { companyId: true },
    });

    await this.db.company.update({
      where: { id: action.companyId },
      data: { updatedAt: new Date() },
    });

    return await this.db.action.delete({ where: { id } });
  }

  async getActionTypes() {
    return await this.db.actionType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    });
  }

  async getCalendarActions(payload: { actionTypes: string }, user: User) {
    const { actionTypes } = payload;

    const actionTypesIds = actionTypes
      ? actionTypes.split(',').map((id) => parseInt(id))
      : [];

    const actions = await this.db.action.findMany({
      where: {
        userId: user.id,
        ...(!!actionTypesIds.length
          ? { actionTypeId: { in: actionTypesIds } }
          : {}),
      },
      include: { actionType: true },
    });

    return actions.map((action) => ({
      id: action.id,
      title: action.object,
      actionType: action.actionType.name,
      actionTypeColor: action.actionType.color,
      startDate: action.startDate.toISOString(),
      endDate: action.endDate ? action.endDate.toISOString() : undefined,
    }));
  }
}
