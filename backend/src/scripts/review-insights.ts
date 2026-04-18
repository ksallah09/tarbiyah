/**
 * review-insights.ts
 *
 * Exports all published insights to a readable markdown file for review.
 * Open the output file, read through, and note any IDs to edit.
 * Then use the --edit flag to update a specific insight.
 *
 * Usage:
 *   npx ts-node src/scripts/review-insights.ts                         # export all to review-insights.md
 *   npx ts-node src/scripts/review-insights.ts --category spiritual    # filter by category
 *   npx ts-node src/scripts/review-insights.ts --edit <id>             # opens edit prompt for one insight
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { supabase } from '../config/supabase';

const OUTPUT_FILE = path.join(__dirname, '../../../review-insights.md');

async function fetchInsights(category?: string) {
  let query = supabase
    .from('insights')
    .select('*')
    .eq('status', 'published')
    .order('category', { ascending: true });

  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function exportToMarkdown(category?: string) {
  console.log('Fetching insights...');
  const rows = await fetchInsights(category);

  if (rows.length === 0) {
    console.log('No published insights found.');
    return;
  }

  let spiritual = rows.filter((r: any) => r.category === 'spiritual');
  let science   = rows.filter((r: any) => r.category === 'scientific' || r.category === 'science');

  let md = `# Tarbiyah Insight Review\n`;
  md += `Generated: ${new Date().toLocaleString()}\n`;
  md += `Total: ${rows.length} insights (${spiritual.length} spiritual, ${science.length} science)\n\n`;
  md += `---\n\n`;
  md += `> To flag an insight: add ⚠️ next to the ID line.\n`;
  md += `> To edit: run \`npx ts-node src/scripts/review-insights.ts --edit <ID>\`\n\n`;

  function writeSection(title: string, items: any[]) {
    md += `# ${title} (${items.length})\n\n`;
    items.forEach((r: any, i: number) => {
      md += `## ${i + 1}. ${r.insight_title || '(no title)'}\n`;
      md += `**ID:** \`${r.id}\`\n`;
      md += `**Source:** ${r.attribution || '—'}\n\n`;
      md += `**Main Insight:**\n${r.daily_insight}\n\n`;
      if (r.spiritual_insight) md += `**Spiritual Context:**\n${r.spiritual_insight}\n\n`;
      if (r.educational_insight) md += `**Research Context:**\n${r.educational_insight}\n\n`;
      if (r.action_step) md += `**Action Step:**\n${r.action_step}\n\n`;
      md += `---\n\n`;
    });
  }

  writeSection('SPIRITUAL INSIGHTS', spiritual);
  writeSection('SCIENCE / RESEARCH INSIGHTS', science);

  fs.writeFileSync(OUTPUT_FILE, md, 'utf8');
  console.log(`\n✓ Exported ${rows.length} insights to:\n  ${OUTPUT_FILE}\n`);
  console.log('Open the file, review the content, and use the IDs to edit specific insights.');
}

async function editInsight(id: string) {
  const { data, error } = await supabase
    .from('insights').select('*').eq('id', id).single();

  if (error || !data) {
    console.error('Insight not found:', id);
    process.exit(1);
  }

  console.log(`\nEditing: ${data.insight_title}`);
  console.log(`Category: ${data.category}`);
  console.log('─'.repeat(60));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(res => rl.question(q, res));

  console.log('\nWhich field do you want to edit?');
  console.log('  1. Insight Title');
  console.log('  2. Main Insight (daily_insight)');
  console.log('  3. Spiritual Context');
  console.log('  4. Research Context');
  console.log('  5. Action Step');
  console.log('  6. Cancel\n');

  const choice = await ask('Enter number: ');

  const fieldMap: Record<string, { col: string; label: string }> = {
    '1': { col: 'insight_title',       label: 'Insight Title' },
    '2': { col: 'daily_insight',       label: 'Main Insight' },
    '3': { col: 'spiritual_insight',   label: 'Spiritual Context' },
    '4': { col: 'educational_insight', label: 'Research Context' },
    '5': { col: 'action_step',         label: 'Action Step' },
  };

  const field = fieldMap[choice.trim()];
  if (!field) { console.log('Cancelled.'); rl.close(); return; }

  console.log(`\nCurrent ${field.label}:`);
  console.log('─'.repeat(60));
  console.log(data[field.col] ?? '(empty)');
  console.log('─'.repeat(60));
  console.log('\nEnter replacement text (paste on one line, press Enter when done):');

  const newText = await ask('> ');

  if (!newText.trim()) { console.log('No change made (empty input).'); rl.close(); return; }

  const confirm = await ask(`\nSave this change? (y/n): `);
  if (confirm.trim().toLowerCase() !== 'y') { console.log('Cancelled.'); rl.close(); return; }

  const { error: updateError } = await supabase
    .from('insights')
    .update({ [field.col]: newText.trim() })
    .eq('id', id);

  rl.close();

  if (updateError) {
    console.error('Update failed:', updateError.message);
  } else {
    console.log(`\n✓ Updated "${field.label}" for insight: ${data.insight_title}`);
  }
}

async function deleteInsight(id: string) {
  const { data, error: fetchError } = await supabase
    .from('insights').select('insight_title, category').eq('id', id).single();

  if (fetchError || !data) {
    console.error('Insight not found:', id);
    process.exit(1);
  }

  console.log(`\nAbout to delete: "${data.insight_title}" (${data.category})`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await new Promise<string>(res => rl.question('Are you sure? This cannot be undone. (y/n): ', res));
  rl.close();

  if (confirm.trim().toLowerCase() !== 'y') { console.log('Cancelled.'); return; }

  const { error } = await supabase.from('insights').delete().eq('id', id);

  if (error) {
    console.error('Delete failed:', error.message);
  } else {
    console.log(`\n✓ Deleted "${data.insight_title}"`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  const editIdx = args.indexOf('--edit');
  if (editIdx !== -1) {
    const id = args[editIdx + 1];
    if (!id) { console.error('Usage: --edit <insight-id>'); process.exit(1); }
    await editInsight(id);
    return;
  }

  const deleteIdx = args.indexOf('--delete');
  if (deleteIdx !== -1) {
    const id = args[deleteIdx + 1];
    if (!id) { console.error('Usage: --delete <insight-id>'); process.exit(1); }
    await deleteInsight(id);
    return;
  }

  const catIdx = args.indexOf('--category');
  const category = catIdx !== -1 ? args[catIdx + 1] : undefined;
  await exportToMarkdown(category);
}

main().catch(err => { console.error(err); process.exit(1); });
