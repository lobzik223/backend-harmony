import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_DIR = process.cwd() + '/uploads';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  private async deleteUploadFileIfExists(url?: string | null) {
    if (!url?.startsWith('/uploads/')) return;
    const relativePath = url.replace(/^\//, '');
    const fullPath = join(process.cwd(), relativePath);
    try {
      await unlink(fullPath);
    } catch {
      // файл уже удален или отсутствует — пропускаем
    }
  }

  private async ensureUploadDirs() {
    await mkdir(join(UPLOAD_DIR, 'covers'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'tracks'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'articles'), { recursive: true });
    await mkdir(join(UPLOAD_DIR, 'course-tracks'), { recursive: true });
  }

  private static readonly COURSE_TRACK_MAX_SIZE = 200 * 1024 * 1024; // 200 MB
  private static readonly COURSE_TRACK_ALLOWED_EXT = ['.mp4', '.m4a', '.mp3', '.wav', '.ogg', '.webm'];

  async saveCourseTrackMedia(buffer: Buffer, ext: string): Promise<string> {
    if (buffer.length > ContentService.COURSE_TRACK_MAX_SIZE) {
      throw new BadRequestException(`Файл превышает 200 МБ. Размер: ${Math.round(buffer.length / 1024 / 1024)} МБ`);
    }
    const extLower = ext.toLowerCase();
    if (!ContentService.COURSE_TRACK_ALLOWED_EXT.includes(extLower)) {
      throw new BadRequestException(
        `Недопустимый формат. Разрешены: ${ContentService.COURSE_TRACK_ALLOWED_EXT.join(', ')}`,
      );
    }
    await this.ensureUploadDirs();
    const name = `${randomUUID()}${extLower}`;
    const path = join(UPLOAD_DIR, 'course-tracks', name);
    await writeFile(path, buffer);
    return `/uploads/course-tracks/${name}`;
  }

  async saveCover(buffer: Buffer, mime: string): Promise<string> {
    await this.ensureUploadDirs();
    let ext = '.jpg';
    if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/webp') ext = '.webp';
    const name = `${randomUUID()}${ext}`;
    const path = join(UPLOAD_DIR, 'covers', name);
    await writeFile(path, buffer);
    return `/uploads/covers/${name}`;
  }

  async saveTrackAudio(buffer: Buffer, ext: string): Promise<string> {
    await this.ensureUploadDirs();
    const safeExt = ['.mp3', '.m4a', '.wav', '.ogg'].includes(ext.toLowerCase()) ? ext : '.mp3';
    const name = `${randomUUID()}${safeExt}`;
    const path = join(UPLOAD_DIR, 'tracks', name);
    await writeFile(path, buffer);
    return `/uploads/tracks/${name}`;
  }

  async saveArticleImage(buffer: Buffer, mime: string): Promise<string> {
    await this.ensureUploadDirs();
    // jpg, png, webp — все хорошо показываются на iOS и Android
    let ext = '.jpg';
    if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/webp') ext = '.webp';
    const name = `${randomUUID()}${ext}`;
    const path = join(UPLOAD_DIR, 'articles', name);
    await writeFile(path, buffer);
    return `/uploads/articles/${name}`;
  }

  // --- Sections ---
  async createSection(dto: CreateSectionDto) {
    return this.prisma.contentSection.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findAllSections(type?: string) {
    return this.prisma.contentSection.findMany({
      where: type ? { type } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tracks: true } } },
    });
  }

  async findSectionsWithTracks(type?: string) {
    return this.prisma.contentSection.findMany({
      where: type ? { type } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: {
        tracks: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            descriptionShort: true,
            coverUrl: true,
            audioUrl: true,
            durationSeconds: true,
            level: true,
            isPremium: true,
            sortOrder: true,
          },
        },
      },
    });
  }

  async findSectionById(id: string) {
    const s = await this.prisma.contentSection.findUnique({
      where: { id },
      include: { tracks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!s) throw new NotFoundException('Section not found');
    return s;
  }

  async updateSection(id: string, dto: UpdateSectionDto) {
    await this.findSectionById(id);
    return this.prisma.contentSection.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.slug != null && { slug: dto.slug }),
        ...(dto.type != null && { type: dto.type }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteSection(id: string) {
    const section = await this.findSectionById(id);
    await Promise.all(
      (section.tracks ?? []).flatMap((track) => [
        this.deleteUploadFileIfExists(track.coverUrl),
        this.deleteUploadFileIfExists(track.audioUrl),
      ]),
    );
    return this.prisma.contentSection.delete({ where: { id } });
  }

  // --- Tracks ---
  async createTrack(dto: CreateTrackDto) {
    return this.prisma.contentTrack.create({
      data: {
        sectionId: dto.sectionId,
        title: dto.title,
        descriptionShort: dto.descriptionShort ?? '',
        coverUrl: dto.coverUrl ?? null,
        audioUrl: dto.audioUrl ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        level: dto.level ?? null,
        isPremium: dto.isPremium ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async findTracks(sectionId?: string, type?: string) {
    const where: { sectionId?: string; section?: { type: string } } = {};
    if (sectionId) where.sectionId = sectionId;
    if (type) where.section = { type };
    return this.prisma.contentTrack.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ section: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: { section: { select: { id: true, name: true, slug: true, type: true } } },
    });
  }

  async findTrackById(id: string) {
    const t = await this.prisma.contentTrack.findUnique({
      where: { id },
      include: { section: true },
    });
    if (!t) throw new NotFoundException('Track not found');
    return t;
  }

  async updateTrack(id: string, dto: UpdateTrackDto) {
    const existing = await this.findTrackById(id);
    const updated = await this.prisma.contentTrack.update({
      where: { id },
      data: {
        ...(dto.sectionId != null && { sectionId: dto.sectionId }),
        ...(dto.title != null && { title: dto.title }),
        ...(dto.descriptionShort != null && { descriptionShort: dto.descriptionShort }),
        ...(dto.coverUrl != null && { coverUrl: dto.coverUrl }),
        ...(dto.audioUrl != null && { audioUrl: dto.audioUrl }),
        ...(dto.durationSeconds != null && { durationSeconds: dto.durationSeconds }),
        ...(dto.level != null && { level: dto.level }),
        ...(dto.isPremium != null && { isPremium: dto.isPremium }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
      },
    });
    if (dto.coverUrl && dto.coverUrl !== existing.coverUrl) {
      await this.deleteUploadFileIfExists(existing.coverUrl);
    }
    if (dto.audioUrl && dto.audioUrl !== existing.audioUrl) {
      await this.deleteUploadFileIfExists(existing.audioUrl);
    }
    return updated;
  }

  async deleteTrack(id: string) {
    const track = await this.findTrackById(id);
    const deleted = await this.prisma.contentTrack.delete({ where: { id } });
    await Promise.all([
      this.deleteUploadFileIfExists(track.coverUrl),
      this.deleteUploadFileIfExists(track.audioUrl),
    ]);
    return deleted;
  }

  // --- Articles ---
  async createArticle(dto: CreateArticleDto) {
    const publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : undefined;
    return this.prisma.article.create({
      data: {
        blockType: dto.blockType,
        title: dto.title,
        descriptionShort: dto.descriptionShort ?? '',
        descriptionFull: dto.descriptionFull ?? null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        ...(publishedAt && { publishedAt }),
        ...(dto.durationMinutes != null && { durationMinutes: dto.durationMinutes }),
      },
    });
  }

  async findArticles(blockType?: string) {
    return this.prisma.article.findMany({
      where: blockType ? { blockType } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findArticleById(id: string) {
    const a = await this.prisma.article.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Article not found');
    return a;
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    await this.findArticleById(id);
    const publishedAt = dto.publishedAt !== undefined
      ? (dto.publishedAt == null ? null : new Date(dto.publishedAt))
      : undefined;
    return this.prisma.article.update({
      where: { id },
      data: {
        ...(dto.blockType != null && { blockType: dto.blockType }),
        ...(dto.title != null && { title: dto.title }),
        ...(dto.descriptionShort != null && { descriptionShort: dto.descriptionShort }),
        ...(dto.descriptionFull != null && { descriptionFull: dto.descriptionFull }),
        ...(dto.imageUrl != null && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
        ...(publishedAt !== undefined && { publishedAt }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
      },
    });
  }

  async deleteArticle(id: string) {
    await this.findArticleById(id);
    return this.prisma.article.delete({ where: { id } });
  }

  // --- Popular tracks by unique listens ---
  async recordTrackListen(trackId: string, userId: string) {
    await this.findTrackById(trackId);
    await this.prisma.trackListen.upsert({
      where: { trackId_userId: { trackId, userId } },
      update: {},
      create: { trackId, userId },
    });
    return { ok: true };
  }

  async getPopularTracks(limit = 10) {
    const safeLimit = Math.max(1, Math.min(10, limit));
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.trackListen.groupBy({
      by: ['trackId'],
      where: { createdAt: { gte: fromDate } },
      _count: { trackId: true },
      orderBy: { _count: { trackId: 'desc' } },
      take: safeLimit,
    });
    if (grouped.length === 0) return [];
    const trackIds = grouped.map((g) => g.trackId);
    const tracks = await this.prisma.contentTrack.findMany({
      where: { id: { in: trackIds } },
      include: { section: { select: { id: true, name: true, slug: true, type: true } } },
    });
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return grouped
      .map((g) => {
        const track = byId.get(g.trackId);
        if (!track) return null;
        return { ...track, listenCount: g._count.trackId };
      })
      .filter((v): v is NonNullable<typeof v> => v != null);
  }

  // --- Courses ---
  async createCourse(dto: CreateCourseDto) {
    const tracks = dto.tracks ?? [];
    if (tracks.length > 10) {
      throw new BadRequestException('Максимум 10 треков в курсе');
    }
    return this.prisma.course.create({
      data: {
        title: dto.title,
        descriptionShort: dto.descriptionShort ?? '',
        descriptionFull: dto.descriptionFull ?? null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? true,
        courseTrackItems: {
          create: tracks.map((t, idx) => ({
            title: t.title,
            descriptionShort: t.descriptionShort ?? '',
            mediaUrl: t.mediaUrl,
            sortOrder: idx,
          })),
        },
      },
      include: {
        courseTrackItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async findCourses(onlyPublished = false) {
    return this.prisma.course.findMany({
      where: onlyPublished ? { isPublished: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        courseTrackItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async findCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        courseTrackItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async updateCourse(id: string, dto: UpdateCourseDto) {
    const course = await this.findCourseById(id);
    const tracks = dto.tracks;
    if (tracks !== undefined) {
      if (tracks.length > 10) {
        throw new BadRequestException('Максимум 10 треков в курсе');
      }
      const oldItems = course.courseTrackItems ?? [];
      await this.prisma.courseTrackItem.deleteMany({ where: { courseId: id } });
      for (const old of oldItems) {
        if (old.mediaUrl?.startsWith('/uploads/course-tracks/')) {
          await this.deleteUploadFileIfExists(old.mediaUrl);
        }
      }
      if (tracks.length > 0) {
        await this.prisma.courseTrackItem.createMany({
          data: tracks.map((t, idx) => ({
            courseId: id,
            title: t.title,
            descriptionShort: t.descriptionShort ?? '',
            mediaUrl: t.mediaUrl,
            sortOrder: idx,
          })),
        });
      }
    }
    await this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.descriptionShort != null && { descriptionShort: dto.descriptionShort }),
        ...(dto.descriptionFull != null && { descriptionFull: dto.descriptionFull }),
        ...(dto.imageUrl != null && { imageUrl: dto.imageUrl }),
        ...(dto.sortOrder != null && { sortOrder: dto.sortOrder }),
        ...(dto.isPublished != null && { isPublished: dto.isPublished }),
      },
    });
    return this.findCourseById(id);
  }

  async deleteCourse(id: string) {
    const course = await this.findCourseById(id);
    for (const item of course.courseTrackItems ?? []) {
      if (item.mediaUrl?.startsWith('/uploads/course-tracks/')) {
        await this.deleteUploadFileIfExists(item.mediaUrl);
      }
    }
    return this.prisma.course.delete({ where: { id } });
  }

  // --- App: home aggregate ---
  async getHome() {
    const trackSelect = {
      id: true,
      title: true,
      descriptionShort: true,
      coverUrl: true,
      audioUrl: true,
      durationSeconds: true,
      level: true,
      isPremium: true,
      sortOrder: true,
    };
    const [sections, featured, recommended, emergency, popularTracks, courses] = await Promise.all([
      this.prisma.contentSection.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          tracks: { orderBy: { sortOrder: 'asc' }, select: trackSelect },
        },
      }),
      this.prisma.article.findFirst({ where: { blockType: 'FEATURED' }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.article.findMany({ where: { blockType: 'RECOMMENDED' }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.article.findMany({ where: { blockType: 'EMERGENCY' }, orderBy: { sortOrder: 'asc' } }),
      this.getPopularTracks(10),
      this.findCourses(true),
    ]);
    const homeSections = sections.filter((s) => s.type === 'HOME');
    const coursesForApp = (courses ?? []).map((c) => ({
      ...c,
      tracks: (c.courseTrackItems ?? []).map((item) => ({
        track: {
          id: item.id,
          coverUrl: c.imageUrl,
          title: item.title,
          descriptionShort: item.descriptionShort,
          isPremium: false,
          audioUrl: item.mediaUrl,
        },
      })),
    }));
    return {
      sections,
      homeSections,
      home: {
        featured: featured ?? null,
        recommended: recommended ?? [],
        emergency: emergency ?? [],
        popularTracks: popularTracks ?? [],
        courses: coursesForApp,
      },
    };
  }
}
