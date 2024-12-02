export function findTweetsMatchingPattern(pattern: RegExp): HTMLElement[] {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  return Array.from(tweets).filter((tweet) => {
    const tweetText = tweet.textContent || '';
    return pattern.test(tweetText);
  }) as HTMLElement[];
} 