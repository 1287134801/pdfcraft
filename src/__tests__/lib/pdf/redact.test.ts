/**
 * Unit Tests for Redact PDF Processor
 * Requirements: 5.1
 * 
 * Tests redaction functionality including validation and area processing.
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  validateRedactionAreas,
  applySolidFill,
  applyPixelate,
  applyBlur,
  renderRedactionAreaOnCanvas,
  redactPDF,
  type RedactionArea,
} from '@/lib/pdf/processors/redact';

describe('Redact Processor', () => {
  describe('validateRedactionAreas', () => {
    it('returns invalid when no areas are provided', () => {
      const result = validateRedactionAreas([], 5);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No redaction areas specified');
    });

    it('returns valid for correct areas', () => {
      const areas: RedactionArea[] = [
        { page: 1, x: 100, y: 200, width: 150, height: 50 },
        { page: 2, x: 50, y: 100, width: 200, height: 30 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid page numbers - page 0', () => {
      const areas: RedactionArea[] = [
        { page: 0, x: 100, y: 200, width: 150, height: 50 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('page number'))).toBe(true);
    });

    it('detects invalid page numbers - page exceeds count', () => {
      const areas: RedactionArea[] = [
        { page: 10, x: 50, y: 100, width: 200, height: 30 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('page number'))).toBe(true);
    });

    it('detects negative width', () => {
      const areas: RedactionArea[] = [
        { page: 1, x: 100, y: 200, width: -50, height: 50 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Width'))).toBe(true);
    });

    it('detects negative height', () => {
      const areas: RedactionArea[] = [
        { page: 1, x: 100, y: 200, width: 50, height: -50 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Height'))).toBe(true);
    });

    it('detects negative x coordinate', () => {
      const areas: RedactionArea[] = [
        { page: 1, x: -100, y: 200, width: 50, height: 50 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('X coordinate'))).toBe(true);
    });

    it('detects negative y coordinate', () => {
      const areas: RedactionArea[] = [
        { page: 1, x: 100, y: -200, width: 50, height: 50 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Y coordinate'))).toBe(true);
    });

    it('reports multiple errors for multiple invalid areas', () => {
      const areas: RedactionArea[] = [
        { page: 0, x: -100, y: -200, width: -50, height: -50 },
      ];

      const result = validateRedactionAreas(areas, 5);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Canvas Pixel Operations', () => {
    it('applies solid fill to canvas context', () => {
      const fillRectMock = vi.fn();
      const fillTextMock = vi.fn();
      const saveMock = vi.fn();
      const restoreMock = vi.fn();

      const mockCtx = {
        save: saveMock,
        restore: restoreMock,
        fillRect: fillRectMock,
        fillText: fillTextMock,
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        canvas: { width: 200, height: 200 },
      } as unknown as CanvasRenderingContext2D;

      applySolidFill(mockCtx, 10, 20, 50, 60, '#000000', 'REDACTED');

      expect(saveMock).toHaveBeenCalled();
      expect(restoreMock).toHaveBeenCalled();
      expect(fillRectMock).toHaveBeenCalledWith(10, 20, 50, 60);
      expect(fillTextMock).toHaveBeenCalledWith('REDACTED', 35, 50, 46);
    });

    it('applies pixelate / mosaic to image data', () => {
      const width = 20;
      const height = 20;
      const buffer = new Uint8ClampedArray(width * height * 4);
      // Fill with gradient
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = (i / 4) % 255;
        buffer[i + 1] = 100;
        buffer[i + 2] = 150;
        buffer[i + 3] = 255;
      }

      const mockImageData = {
        data: buffer,
        width,
        height,
      } as ImageData;

      const getImageDataMock = vi.fn(() => mockImageData);
      const putImageDataMock = vi.fn();

      const mockCtx = {
        canvas: { width: 100, height: 100 },
        getImageData: getImageDataMock,
        putImageData: putImageDataMock,
      } as unknown as CanvasRenderingContext2D;

      applyPixelate(mockCtx, 0, 0, 20, 20, 5);

      expect(getImageDataMock).toHaveBeenCalled();
      expect(putImageDataMock).toHaveBeenCalledWith(mockImageData, 0, 0);
    });

    it('applies blur to image data', () => {
      const width = 20;
      const height = 20;
      const buffer = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 200;
        buffer[i + 1] = 100;
        buffer[i + 2] = 50;
        buffer[i + 3] = 255;
      }

      const mockImageData = {
        data: buffer,
        width,
        height,
      } as ImageData;

      const getImageDataMock = vi.fn(() => mockImageData);
      const putImageDataMock = vi.fn();

      const mockCtx = {
        canvas: { width: 100, height: 100 },
        getImageData: getImageDataMock,
        putImageData: putImageDataMock,
      } as unknown as CanvasRenderingContext2D;

      applyBlur(mockCtx, 0, 0, 20, 20, 4);

      expect(getImageDataMock).toHaveBeenCalled();
      expect(putImageDataMock).toHaveBeenCalledWith(mockImageData, 0, 0);
    });

    it('renderRedactionAreaOnCanvas dispatches correct style operations', () => {
      const fillRectMock = vi.fn();
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: fillRectMock,
        fillText: vi.fn(),
        fillStyle: '',
        canvas: { width: 500, height: 500 },
      } as unknown as CanvasRenderingContext2D;

      const blackoutArea: RedactionArea = {
        page: 1,
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        pageWidth: 500,
        pageHeight: 500,
        style: 'blackout',
      };

      renderRedactionAreaOnCanvas(mockCtx, blackoutArea, 500, 500);
      expect(fillRectMock).toHaveBeenCalledWith(10, 10, 100, 50);

      const whiteoutArea: RedactionArea = {
        page: 1,
        x: 20,
        y: 30,
        width: 60,
        height: 40,
        pageWidth: 500,
        pageHeight: 500,
        style: 'whiteout',
      };

      renderRedactionAreaOnCanvas(mockCtx, whiteoutArea, 500, 500);
      expect(fillRectMock).toHaveBeenCalledWith(20, 30, 60, 40);
    });

    it('exports redactPDF function for processor execution', () => {
      expect(typeof redactPDF).toBe('function');
    });
  });
});
