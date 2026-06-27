import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderBlocksDto {
  /**
   * Ordered array of block IDs. The service assigns sortOrder values
   * 1.0, 2.0, 3.0... in the order submitted.
   * All IDs must belong to the target sectionId.
   */
  @ApiProperty({
    type:        [String],
    description: 'Block IDs in the desired display order',
    example:     ['blk_abc', 'blk_def', 'blk_ghi'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds: string[];
}
