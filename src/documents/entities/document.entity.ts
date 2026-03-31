import { TransformToS3Path } from 'src/utils/functions/transformS3';

export class DocumentEntity {
  @TransformToS3Path()
  url: string;
}
