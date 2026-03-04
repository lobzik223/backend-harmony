import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ContentService } from './content.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

const COVER_LIMIT = 5 * 1024 * 1024; // 5 MB
const ARTICLE_IMAGE_LIMIT = 1 * 1024 * 1024; // 1 MB — только обложки статей (jpg/png)
const AUDIO_LIMIT = 80 * 1024 * 1024; // 80 MB

@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('sections')
  getSections(@Query('type') type?: string) {
    return this.content.findAllSections(type);
  }

  @Get('tracks')
  getTracks(@Query('sectionId') sectionId?: string, @Query('type') type?: string) {
    return this.content.findTracks(sectionId, type);
  }

  @Get('home')
  getHome() {
    return this.content.getHome();
  }

  @Get('articles')
  getArticles(@Query('blockType') blockType?: string) {
    return this.content.findArticles(blockType);
  }

  @Get('popular-tracks')
  getPopularTracks(@Query('limit') limit?: string) {
    const n = Number(limit ?? 10);
    const safe = Number.isFinite(n) ? n : 10;
    return this.content.getPopularTracks(safe);
  }

  @Get('courses')
  getCourses(@Query('published') published?: string) {
    const onlyPublished = published === '1' || published === 'true';
    return this.content.findCourses(onlyPublished);
  }

  @Get('sections/:id')
  getSection(@Param('id') id: string) {
    return this.content.findSectionById(id);
  }

  @Get('tracks/:id')
  getTrack(@Param('id') id: string) {
    return this.content.findTrackById(id);
  }

  @Get('articles/:id')
  getArticle(@Param('id') id: string) {
    return this.content.findArticleById(id);
  }

  @Get('courses/:id')
  getCourse(@Param('id') id: string) {
    return this.content.findCourseById(id);
  }

  @Post('sections')
  @UseGuards(AdminJwtGuard)
  createSection(@Body() dto: CreateSectionDto) {
    return this.content.createSection(dto);
  }

  @Patch('sections/:id')
  @UseGuards(AdminJwtGuard)
  updateSection(@Param('id') id: string, @Body() dto: UpdateSectionDto) {
    return this.content.updateSection(id, dto);
  }

  @Delete('sections/:id')
  @UseGuards(AdminJwtGuard)
  deleteSection(@Param('id') id: string) {
    return this.content.deleteSection(id);
  }

  @Post('tracks')
  @UseGuards(AdminJwtGuard)
  createTrack(@Body() dto: CreateTrackDto) {
    return this.content.createTrack(dto);
  }

  @Patch('tracks/:id')
  @UseGuards(AdminJwtGuard)
  updateTrack(@Param('id') id: string, @Body() dto: UpdateTrackDto) {
    return this.content.updateTrack(id, dto);
  }

  @Delete('tracks/:id')
  @UseGuards(AdminJwtGuard)
  deleteTrack(@Param('id') id: string) {
    return this.content.deleteTrack(id);
  }

  @Post('articles')
  @UseGuards(AdminJwtGuard)
  createArticle(@Body() dto: CreateArticleDto) {
    return this.content.createArticle(dto);
  }

  @Patch('articles/:id')
  @UseGuards(AdminJwtGuard)
  updateArticle(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.content.updateArticle(id, dto);
  }

  @Delete('articles/:id')
  @UseGuards(AdminJwtGuard)
  deleteArticle(@Param('id') id: string) {
    return this.content.deleteArticle(id);
  }

  @Post('tracks/:id/listen')
  @UseGuards(JwtAccessGuard)
  registerTrackListen(@Param('id') id: string, @Req() req: { user?: { sub?: string } }) {
    const userId = req?.user?.sub;
    if (!userId) throw new BadRequestException('userId required');
    return this.content.recordTrackListen(id, userId);
  }

  @Post('courses')
  @UseGuards(AdminJwtGuard)
  createCourse(@Body() dto: CreateCourseDto) {
    return this.content.createCourse(dto);
  }

  @Patch('courses/:id')
  @UseGuards(AdminJwtGuard)
  updateCourse(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.content.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  @UseGuards(AdminJwtGuard)
  deleteCourse(@Param('id') id: string) {
    return this.content.deleteCourse(id);
  }

  @Post('upload/cover')
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: COVER_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(null, ok);
      },
    }),
  )
  async uploadCover(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file');
    const url = await this.content.saveCover(file.buffer, file.mimetype);
    return { url };
  }

  @Post('upload/track')
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: AUDIO_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = ['audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/wav', 'audio/ogg', 'audio/x-wav'].includes(file.mimetype) ||
          file.originalname?.toLowerCase().endsWith('.mp3');
        cb(null, !!ok);
      },
    }),
  )
  async uploadTrack(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file');
    const ext = file.originalname ? extname(file.originalname) : '.mp3';
    const url = await this.content.saveTrackAudio(file.buffer, ext);
    let durationSeconds: number | undefined;
    try {
      const { parseBuffer } = await import('music-metadata');
      const metadata = await parseBuffer(file.buffer, { mimeType: file.mimetype }, { duration: true });
      if (metadata.format?.duration != null && metadata.format.duration > 0) {
        durationSeconds = Math.round(metadata.format.duration);
      }
    } catch {
      // не удалось прочитать длительность — оставляем undefined
    }
    return { url, size: file.buffer.length, durationSeconds };
  }

  @Post('upload/article-image')
  @UseGuards(AdminJwtGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: ARTICLE_IMAGE_LIMIT },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(null, ok);
      },
    }),
  )
  async uploadArticleImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не выбран');
    const url = await this.content.saveArticleImage(file.buffer, file.mimetype);
    return { url };
  }
}
