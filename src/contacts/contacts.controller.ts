import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactSendEmailsDto } from './dto/contact-send-emails.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { GetAllContactsDto } from './dto/get-all-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { User } from '@prisma/client';
import { AuthUser } from 'src/auth/decorators';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}
  @Post()
  create(@Body() input: CreateContactDto) {
    return this.contactsService.createContact(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateContactDto) {
    return this.contactsService.updateContact(+id, input);
  }

  @Get('all-Contacts/:id')
  getAll(@Query() payload: GetAllContactsDto, @Param('id') id: string) {
    return this.contactsService.getContacts(+id, payload);
  }

  @Get('options')
  getContactOptions(@Query() payload: { companyId: string }) {
    return this.contactsService.getContactOptions(payload);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contactsService.getContactById(+id);
  }

  @Post('send-emails')
  sendEmails(@Body() payload: ContactSendEmailsDto, @AuthUser() user: User) {
    return this.contactsService.sendEmails(payload, user);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.contactsService.deleteContact(+id);
  }
}
