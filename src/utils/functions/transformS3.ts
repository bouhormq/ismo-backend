import { Transform } from 'class-transformer';

export const addS3Url = (value: any, folderPath?: string) => {
  return `${process.env.S3_BASE_URL}/${folderPath}/${encodeURIComponent(value)}`;
};

export const TransformToS3Path = (validateNested?: boolean) => {
  return Transform(({ value }) => {
    if (!value) return null;
    if (!validateNested && value.startsWith('http')) return value;
    if (Array.isArray(value))
      return value.map((item) => {
        if (item.startsWith('http')) return item;
        return addS3Url(item, 'documents');
      });
    return validateNested ? value.map(addS3Url) : addS3Url(value, 'documents');
  });
};
