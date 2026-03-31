import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { UpdateActionDto } from './dto/update-action.dto';
import { GetAllCompanyActionsDto } from './dto/get-all-company-actions.dto';
import { AuthUser } from 'src/auth/decorators';
import { User } from '@prisma/client';

@Controller('actions')
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  create(@Body() createActionDto: CreateActionDto) {
    return this.actionsService.create(createActionDto);
  }

  @Get()
  findAll(@Query() payload: GetAllCompanyActionsDto) {
    return this.actionsService.findAll(payload);
  }

  @Get('notifications')
  getNotifications(
    @Query() query: { date: string; tzOffset: string },
    @AuthUser() user: User,
  ) {
    return this.actionsService.getNotifications(user.id, query);
  }

  @Get('options')
  getActionOptions(@Body() payload: { companyId: number }) {
    return this.actionsService.getActionOptions(payload);
  }

  @Get('action-types')
  getActionTypes() {
    return this.actionsService.getActionTypes();
  }

  @Get('calendar-actions')
  getCalendarActions(
    @Query() payload: { actionTypes: string },
    @AuthUser() user: User,
  ) {
    return this.actionsService.getCalendarActions(payload, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateActionDto: UpdateActionDto) {
    return this.actionsService.update(+id, updateActionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.actionsService.remove(+id);
  }
}
