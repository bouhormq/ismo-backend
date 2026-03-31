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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetAllDocumentsDto } from './dto/get-all-documents.dto';
import { plainToInstance } from 'class-transformer';
import { DocumentEntity } from './entities/document.entity';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() input: CreateDocumentDto) {
    return this.documentsService.createDocument(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateDocumentDto) {
    return this.documentsService.updateDocument(+id, input);
  }

  @Get('all-documents/:id')
  async getAll(@Query() payload: GetAllDocumentsDto, @Param('id') id: string) {
    const documents = await this.documentsService.getDocuments(+id, payload);
    const entities = documents.data.map((document) =>
      plainToInstance(DocumentEntity, document),
    );
    return { data: entities, count: documents.count };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const docuemnt = await this.documentsService.getDocumentById(+id);
    return plainToInstance(DocumentEntity, docuemnt);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.documentsService.deleteDocument(+id);
  }
}
