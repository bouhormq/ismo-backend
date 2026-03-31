import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetAllDocumentsDto } from './dto/get-all-documents.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  async createDocument(input: CreateDocumentDto) {
    return this.db.document.create({
      data: input,
    });
  }

  async getDocuments(id: number, payload: GetAllDocumentsDto) {
    const { order, key, offset, limit, search, relationType } = payload;
    const where: Prisma.DocumentWhereInput =
      relationType === 'company' ? { companyId: id } : { articleId: id };

    const orderBy: Prisma.DocumentOrderByWithRelationInput = {};

    if (key) {
      switch (key) {
        case 'date':
          orderBy.createdAt = order;
          break;
        case 'name':
          orderBy.name = order;
          break;
        default:
          order[key] = order;
          break;
      }
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const data = await this.db.document.findMany({
      skip: offset * limit,
      take: limit,
      orderBy,
      where,
    });

    const count = await this.db.document.count();

    return { data, count };
  }

  async getDocumentById(id: number) {
    return this.db.document.findUnique({
      where: {
        id,
      },
    });
  }

  async updateDocument(id: number, input: UpdateDocumentDto) {
    return this.db.document.update({
      where: {
        id,
      },
      data: input,
    });
  }

  async deleteDocument(id: number) {
    return this.db.document.delete({
      where: {
        id,
      },
    });
  }
}
