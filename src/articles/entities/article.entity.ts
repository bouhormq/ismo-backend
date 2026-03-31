import { Prisma } from '@prisma/client';
import type { DeepPartial } from 'src/types/util.types';
import { getS3Url } from 'src/utils/functions/misc.functions';

type FullArticleType = Prisma.ArticleGetPayload<{
  include: {
    photos: true;
    company: true;
    category: true;
    industry: true;
    section: true;
  };
}>;

export function ArticleTableTransformer(data: DeepPartial<FullArticleType>) {
  return {
    id: data.id,
    photo: data.photos[0]?.url
      ? getS3Url(`documents/${data.photos[0]?.url}`)
      : null,
    reference: data.reference,
    title: data.title,
    category: data.category?.name ?? '',
    section: data.section?.name ?? '',
    purchasePriceWithoutTVA: data.purchasePriceWithoutTVA
      ? `${data.purchasePriceWithoutTVA} €`
      : '-',
    equipmentCondition: data.equipmentCondition,
    companyName: data.company?.companyName,
    companyCountry: data.company?.country,
    companyCity: data.company?.city,
  };
}
