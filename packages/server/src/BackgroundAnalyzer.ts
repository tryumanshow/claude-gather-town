import { createHash } from 'crypto';
import { AGENT_ROSTER, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, getRosterAgent } from '@theater/shared';
import type { ZoneName } from '@theater/shared';
import { runSDKQuery } from './utils/sdkQueryHelper.js';

export interface DetectedSeat {
  rosterId: string;
  worldX: number;
  worldY: number;
  label: string;
}

type RawSeat = { rosterId: string; nx: number; ny: number; label: string };

export class BackgroundAnalyzer {
  private imageCache: Map<string, DetectedSeat[]> = new Map();

  async analyze(imageData: string, imageWidth: number, imageHeight: number, logFn?: (msg: string) => void, force?: boolean): Promise<DetectedSeat[]> {
    const log = logFn ?? ((msg: string) => console.log('[BackgroundAnalyzer]', msg));

    // Fast hash: prefix + suffix + length (avoids hashing megabytes of base64)
    const hash = createHash('md5')
      .update(imageData.slice(0, 1024))
      .update(imageData.slice(-512))
      .update(String(imageData.length))
      .digest('hex');

    if (!force) {
      const cached = this.imageCache.get(hash);
      if (cached) {
        log('Using cached analysis');
        return cached;
      }
    }

    // Extract media type and base64 from data URL
    const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      console.error('BackgroundAnalyzer: invalid image data URL');
      return [];
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    const base64Data = match[2];

    // Build roster summary
    const rosterSummary = AGENT_ROSTER
      .map(a => `- ${a.id}: ${a.name} — ${a.role} (${a.skills.slice(0, 3).join(', ')})`)
      .join('\n');

    const analysisPrompt = `This is an office floor plan image. For each workstation/desk, find the **chair circle** position.

## Step-by-step instructions:
1. Scan the image and identify every desk/workstation unit
2. For each desk, find the role label text (e.g. "CTO", "Full-Stack Dev", "Backend Engineer")
3. For each desk, find the **circular chair marker** — a small circle/oval shape that represents where a person sits
4. The chair circle is SEPARATE from the rectangular desk surface
5. In a typical floor plan: the chair circle is adjacent to the desk, usually at the bottom edge or top edge of the desk rectangle — NOT in the center of the desk
6. Return the CENTER of the chair circle, not the center of the desk

## Critical: How to find the chair circle
- Look for a ROUND shape (circle or ellipse) near each desk
- The chair circle is typically SMALLER than the desk
- If the label is at the TOP of the desk → chair circle is BELOW the desk (ny is LARGER than the desk center)
- If the label is at the BOTTOM of the desk → chair circle is ABOVE the desk (ny is SMALLER than the desk center)
- The chair circle is often at the BOTTOM of the workstation cluster

## Team roster (rosterId → name/role):
${rosterSummary}

## Matching rules:
- Match image text labels to roster members by name or role (Korean or English)
- If no exact match, assign to similar role
- Omit seats if no match found

## Response (JSON only, no other text):
{
  "seats": [
    { "rosterId": "alex", "nx": 0.3, "ny": 0.55, "label": "detected text" }
  ]
}

nx and ny are ratios 0.0–1.0 relative to total image width/height. ny=0 is top, ny=1 is bottom.`;

    log('Analyzing image via Claude SDK...');
    const rawSeats = await this.analyzeViaSDK(base64Data, mediaType, analysisPrompt, log);
    const result = this.convertSeats(rawSeats, log);
    this.imageCache.set(hash, result);
    return result;
  }

  clearCache(): void {
    this.imageCache.clear();
  }

  private async analyzeViaSDK(
    base64Data: string,
    mediaType: string,
    prompt: string,
    log: (msg: string) => void,
  ): Promise<RawSeat[]> {
    // Save image to temp file for SDK Read tool
    const { writeFileSync, unlinkSync, mkdtempSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const ext = mediaType.includes('png') ? 'png' : mediaType.includes('gif') ? 'gif' : 'jpg';
    let tempDir: string | null = null;
    let tempImagePath: string | null = null;

    const cleanup = () => {
      if (tempImagePath) try { unlinkSync(tempImagePath!); } catch { /* ignore */ }
      if (tempDir) try { unlinkSync(tempDir!); } catch { /* ignore */ }
    };

    try {
      tempDir = mkdtempSync(join(tmpdir(), 'bg-analyze-'));
      tempImagePath = join(tempDir, `bg.${ext}`);
      writeFileSync(tempImagePath, Buffer.from(base64Data, 'base64'));
      log(`Temp image file: ${tempImagePath}`);

      const fullPrompt = `Use the Read tool to read the image file at: ${tempImagePath}\n\nAfter viewing the image, analyze it for office seat positions.\n\n${prompt}`;

      const resultText = await runSDKQuery({
        prompt: fullPrompt,
        maxTurns: 3,
        allowedTools: ['Read'],
        systemPromptAppend: '\n\nYou are an image analyzer. Read the image file and analyze it for office seat positions. Output JSON only.',
        timeoutMs: 90000,
        bypassPermissions: true,
      }) ?? '';

      log(`SDK response (first 400 chars): ${resultText.slice(0, 400)}`);
      return this.parseSeatsFromText(resultText, log);
    } catch (err) {
      console.error('BackgroundAnalyzer (SDK) failed:', err);
      return [];
    } finally {
      cleanup();
    }
  }

  private parseSeatsFromText(text: string, log: (msg: string) => void): RawSeat[] {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log('JSON parse failed: no JSON found in response.');
      return [];
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { seats: RawSeat[] };
      log(`Parsed seats: ${JSON.stringify(parsed.seats?.slice(0, 3))}`);
      return parsed.seats || [];
    } catch {
      log('JSON parse error');
      return [];
    }
  }

  private convertSeats(rawSeats: RawSeat[], log: (msg: string) => void): DetectedSeat[] {
    const worldW = MAP_WIDTH * TILE_SIZE;
    const worldH = MAP_HEIGHT * TILE_SIZE;

    const resolveRosterId = (s: RawSeat): string | null => {
      if (getRosterAgent(s.rosterId)) return s.rosterId;
      const labelLower = (s.label || s.rosterId || '').toLowerCase();
      const byName = AGENT_ROSTER.find(a => labelLower.includes(a.name.toLowerCase()));
      if (byName) return byName.id;
      const byRole = AGENT_ROSTER.find(a =>
        a.role.toLowerCase().split(/[\s/]+/).some(word => word.length > 3 && labelLower.includes(word))
      );
      if (byRole) return byRole.id;
      return null;
    };

    const result = rawSeats
      .map(s => ({ ...s, resolvedId: resolveRosterId(s) }))
      .filter(s => s.resolvedId !== null)
      .map(s => ({
        rosterId: s.resolvedId!,
        worldX: Math.round(s.nx * worldW),
        worldY: Math.round(s.ny * worldH),
        label: s.label || '',
      }));

    log(`Parsed ${result.length} seats (rosters: ${result.map(s => s.rosterId).join(', ') || 'none'})`);
    return result;
  }

  /** Get zone name for a roster agent */
  getHomeZone(rosterId: string): ZoneName {
    return (getRosterAgent(rosterId)?.homeZone ?? 'spawn') as ZoneName;
  }
}
