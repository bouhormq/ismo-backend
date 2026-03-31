import { Prisma } from '@prisma/client';

type ArticleCompanyType = Prisma.ArticleGetPayload<{
  include: {
    photos: { select: { id: true; name: true; url: true; description: true } };
    category: { select: { id: true; name: true } };
    industry: { select: { id: true; name: true } };
    section: { select: { id: true; name: true } };
  };
}>;

export function DetailedArticleTransformer(data: ArticleCompanyType) {
  return {
    ...data,
    company: data.companyId,
    purchasePriceWithoutTVA: data.purchasePriceWithoutTVA
      ? String(data.purchasePriceWithoutTVA)
      : undefined,
    purchasePriceWithTVA: data.purchasePriceWithTVA
      ? String(data.purchasePriceWithTVA)
      : undefined,
    sellingPriceWithoutTVA: data.sellingPriceWithoutTVA
      ? String(data.sellingPriceWithoutTVA)
      : undefined,
    sellingPriceWithTVA: data.sellingPriceWithTVA
      ? String(data.sellingPriceWithTVA)
      : undefined,
    marginRate: data.marginRate ? String(data.marginRate) : undefined,
  };
}
