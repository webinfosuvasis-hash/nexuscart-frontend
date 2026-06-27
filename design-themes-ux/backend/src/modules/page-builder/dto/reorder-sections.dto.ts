import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderSectionItem {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderSectionsDto {
  @ApiProperty({ type: [ReorderSectionItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderSectionItem)
  sections: ReorderSectionItem[];
}
