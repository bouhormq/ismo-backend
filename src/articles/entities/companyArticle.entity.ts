import { Article } from '@prisma/client';
import type { DeepPartial } from 'src/types/util.types';

type FullArticleType = Article;

export function CompanyArticleTableTransformer(
  data: DeepPartial<FullArticleType>,
) {
  return {
    id: data.id,
    createdAt: data.createdAt,
    reference: data.reference,
    title: data.title,
    purchasePriceWithoutTVA: data.purchasePriceWithoutTVA
      ? data.purchasePriceWithoutTVA + ' €'
      : 'N/A',
    equipmentCondition: data.equipmentCondition,
  };
}
