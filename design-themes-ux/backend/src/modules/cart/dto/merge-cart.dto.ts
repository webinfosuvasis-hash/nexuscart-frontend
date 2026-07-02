import { IsNotEmpty, IsString } from 'class-validator';

export class MergeCartDto {
  @IsString()
  @IsNotEmpty()
  guestCartId: string;
}
