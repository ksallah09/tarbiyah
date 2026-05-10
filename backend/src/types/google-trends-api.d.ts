declare module 'google-trends-api' {
  interface TrendsOptions {
    trendDate?: Date;
    geo?: string;
    category?: number;
    hl?: string;
  }
  function dailyTrends(opts: TrendsOptions): Promise<string>;
  function realTimeTrends(opts: { geo: string; category: string }): Promise<string>;
  export = { dailyTrends, realTimeTrends };
}
