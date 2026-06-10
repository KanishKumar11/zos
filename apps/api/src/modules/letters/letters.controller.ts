import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Role } from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';

import { GenerateInternshipLetterDto } from './dto/generate-letter.dto';
import { LettersService } from './letters.service';

@Controller('letters')
@Roles(Role.OWNER)
export class LettersController {
  constructor(private readonly svc: LettersService) {}

  @Post('internship')
  async internship(@Body() body: GenerateInternshipLetterDto, @Res() res: Response) {
    const buffer = await this.svc.generateInternshipLetter(body);
    const slug = body.candidateName.replace(/\s+/g, '_');
    const filename = `Zlaark_Internship_${slug}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
