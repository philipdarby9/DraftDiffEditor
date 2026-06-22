(function initDraftDiffCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.DraftDiffCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function createDraftDiffCore() {
  "use strict";

  const DIFF_COMMON_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from",
    "had", "has", "have", "he", "her", "his", "i", "in", "is", "it", "its", "me",
    "my", "not", "of", "on", "or", "our", "she", "so", "that", "the", "their",
    "them", "then", "there", "they", "this", "to", "was", "we", "were", "with",
    "you", "your"
  ]);

  const DIFF_CLAUSE_STARTERS = new Set([
    "and", "but", "or", "so", "then", "yet", "though", "although", "because",
    "while", "when", "where", "who", "which", "that", "one", "two", "some",
    "couple", "another", "other", "others", "going", "no", "i", "he", "she",
    "they", "we", "it", "the", "there", "this"
  ]);

  const DIFF_BOUNDARY_CONJUNCTIONS = new Set(["and", "but", "or", "so", "yet"]);
  const DIFF_LONG_COMMA_CLAUSE_MIN_TERMS = 4;
  const DIFF_LONG_CONJUNCTION_CLAUSE_MIN_TERMS = 4;
  const meaningfulTermsCache = new WeakMap();

  function asText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeDiffSource(text) {
    return asText(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function diffTextSignature(value) {
    const text = String(value || "");
    return `${text.length}:${hashText(text)}`;
  }

  function semanticKeyForMarks(marks = {}) {
    return marks.whitespace
      ? ""
      : `${marks.bold ? "b" : ""}${marks.italic ? "i" : ""}${marks.underline ? "u" : ""}${marks.strike ? "s" : ""}`;
  }

  function tokenizeText(text, marks = {}) {
    const normalized = normalizeDiffSource(text);
    const tokenRegex = /\n|[^\S\n]+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu;
    const semanticKey = semanticKeyForMarks(marks);
    const tokens = [];
    let match = tokenRegex.exec(normalized);

    while (match) {
      const token = match[0];
      tokens.push({
        key: /^\s+$/u.test(token) ? token : `${token}|${semanticKey}`,
        text: token,
        marks: { ...marks },
        isWhitespace: /^\s+$/u.test(token),
        start: match.index,
        end: match.index + token.length
      });
      match = tokenRegex.exec(normalized);
    }

    return tokens.map((token, index) => ({ ...token, index }));
  }

  function isDiffSequenceWordText(text) {
    return /^[\p{L}\p{N}]+$/u.test(text || "");
  }

  function isDiffSequenceWhitespaceText(text) {
    return /^\s+$/u.test(text || "");
  }

  function isChangedDiffPart(part) {
    return part?.type === "added" || part?.type === "removed";
  }

  function isDiffWordToken(token) {
    return /^[\p{L}\p{N}]+$/u.test(token?.text || "");
  }

  function diffTermForToken(token) {
    return String(token?.text || "").toLowerCase();
  }

  function comparableDiffTerm(term) {
    return String(term || "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
  }

  function meaningfulTermsForTokens(tokens) {
    const cached = meaningfulTermsCache.get(tokens);
    if (cached) return cached;

    const terms = tokens
      .filter(isDiffWordToken)
      .map(diffTermForToken)
      .filter(term => term.length > 1 && !DIFF_COMMON_WORDS.has(term));

    if (terms.length) {
      meaningfulTermsCache.set(tokens, terms);
      return terms;
    }

    const fallbackTerms = tokens
      .filter(isDiffWordToken)
      .map(diffTermForToken)
      .filter(term => term.length > 1);
    meaningfulTermsCache.set(tokens, fallbackTerms);
    return fallbackTerms;
  }

  function isDiffClauseDashToken(token) {
    const text = token?.text || "";
    return text === "\u2014" || text === "\u2013";
  }

  function splitDiffBlocks(tokens) {
    const blocks = [];
    let current = [];
    let pendingSentenceBoundary = false;
    const closingPunctuation = new Set([")", "]", "}", "\"", "'", "\u201d", "\u2019"]);

    const flush = () => {
      if (!current.length) return;
      if (current.some(token => String(token.text || "").trim() || token.text === "\n")) {
        blocks.push(current);
      }
      current = [];
      pendingSentenceBoundary = false;
    };

    const shouldSplitAfterComma = index => {
      let nextWord = "";
      const clauseTokens = [];

      for (let nextIndex = index + 1; nextIndex < tokens.length; nextIndex += 1) {
        const nextToken = tokens[nextIndex];
        if (nextToken.text === "\n") return true;
        if (/[.!?:;]/u.test(nextToken.text || "") || nextToken.text === "," || isDiffClauseDashToken(nextToken)) break;
        clauseTokens.push(nextToken);
        if (/^\s+$/u.test(nextToken.text || "")) continue;
        if (!isDiffWordToken(nextToken)) break;
        if (!nextWord) nextWord = diffTermForToken(nextToken);
      }

      return Boolean(
        nextWord &&
        (
          DIFF_CLAUSE_STARTERS.has(nextWord) ||
          meaningfulTermsForTokens(clauseTokens).length >= DIFF_LONG_COMMA_CLAUSE_MIN_TERMS
        )
      );
    };

    const shouldSplitAfterConjunction = index => {
      if (!isDiffWordToken(tokens[index])) return false;
      if (!DIFF_BOUNDARY_CONJUNCTIONS.has(diffTermForToken(tokens[index]))) return false;

      let nextWord = "";
      const clauseTokens = [];

      for (let nextIndex = index + 1; nextIndex < tokens.length; nextIndex += 1) {
        const nextToken = tokens[nextIndex];
        if (nextToken.text === "\n") break;
        if (/[.!?:;]/u.test(nextToken.text || "") || nextToken.text === "," || isDiffClauseDashToken(nextToken)) break;
        clauseTokens.push(nextToken);
        if (/^\s+$/u.test(nextToken.text || "")) continue;
        if (!isDiffWordToken(nextToken)) break;
        if (!nextWord) nextWord = diffTermForToken(nextToken);
      }

      return Boolean(
        nextWord &&
        meaningfulTermsForTokens(clauseTokens).length >= DIFF_LONG_CONJUNCTION_CLAUSE_MIN_TERMS
      );
    };

    tokens.forEach((token, index) => {
      const isWhitespace = /^\s+$/u.test(token.text || "");
      if (token.text === "(" && current.some(currentToken => String(currentToken.text || "").trim())) flush();
      if (pendingSentenceBoundary && !isWhitespace && !closingPunctuation.has(token.text)) flush();

      current.push(token);
      if (token.text === "\n") {
        flush();
      } else if (
        /[.!?:;]/u.test(token.text || "") ||
        isDiffClauseDashToken(token) ||
        (token.text === "," && shouldSplitAfterComma(index)) ||
        shouldSplitAfterConjunction(index)
      ) {
        pendingSentenceBoundary = true;
      }
    });

    flush();
    return blocks;
  }

  function blockSimilarity(beforeBlock, afterBlock) {
    const beforeTerms = meaningfulTermsForTokens(beforeBlock);
    const afterTerms = meaningfulTermsForTokens(afterBlock);
    if (!beforeTerms.length || !afterTerms.length) return 0;

    const availableBeforeTerms = new Map();
    beforeTerms.forEach(term => {
      const normalizedTerm = comparableDiffTerm(term);
      if (!normalizedTerm) return;
      availableBeforeTerms.set(normalizedTerm, (availableBeforeTerms.get(normalizedTerm) || 0) + 1);
    });

    let shared = 0;
    afterTerms.forEach(term => {
      const normalizedTerm = comparableDiffTerm(term);
      const availableCount = availableBeforeTerms.get(normalizedTerm) || 0;
      if (!availableCount) return;
      shared += 1;
      if (availableCount === 1) {
        availableBeforeTerms.delete(normalizedTerm);
      } else {
        availableBeforeTerms.set(normalizedTerm, availableCount - 1);
      }
    });

    if (!shared) return 0;
    return (2 * shared) / (beforeTerms.length + afterTerms.length);
  }

  function blockAlignmentWeight(beforeBlock, afterBlock) {
    const beforeTerms = meaningfulTermsForTokens(beforeBlock);
    const afterTerms = meaningfulTermsForTokens(afterBlock);
    const shorterLength = Math.min(beforeTerms.length, afterTerms.length);
    if (!shorterLength) return 0;

    const similarity = blockSimilarity(beforeBlock, afterBlock);
    const threshold = shorterLength <= 2 ? 0.5 : shorterLength <= 3 ? 0.42 : 0.38;
    return similarity >= threshold ? similarity : 0;
  }

  function pairOrder(left, right) {
    return left[0] - right[0] || left[1] - right[1];
  }

  function linearScoreRow(before, after, beforeStart, beforeEnd, afterStart, afterEnd, isMatch, reverse = false) {
    const afterLength = afterEnd - afterStart;
    let previous = Array(afterLength + 1).fill(0);
    let current = Array(afterLength + 1).fill(0);
    const beforeStep = reverse ? -1 : 1;
    let beforeIndex = reverse ? beforeEnd - 1 : beforeStart;

    while (reverse ? beforeIndex >= beforeStart : beforeIndex < beforeEnd) {
      current[0] = 0;
      for (let offset = 0; offset < afterLength; offset += 1) {
        const afterIndex = reverse ? afterEnd - 1 - offset : afterStart + offset;
        current[offset + 1] = isMatch(before[beforeIndex], after[afterIndex])
          ? previous[offset] + 1
          : Math.max(previous[offset + 1], current[offset]);
      }

      const reusable = previous;
      previous = current;
      current = reusable;
      beforeIndex += beforeStep;
    }

    return previous;
  }

  function bestLinearSplit(forwardScores, reverseScores) {
    const afterLength = forwardScores.length - 1;
    let bestSplit = 0;
    let bestScore = -Infinity;

    for (let split = 0; split <= afterLength; split += 1) {
      const score = forwardScores[split] + reverseScores[afterLength - split];
      if (score >= bestScore) {
        bestScore = score;
        bestSplit = split;
      }
    }

    return bestSplit;
  }

  function linearLcsPairsByBefore(before, after, isMatch, beforeStart, beforeEnd, afterStart, afterEnd) {
    const beforeLength = beforeEnd - beforeStart;
    const afterLength = afterEnd - afterStart;
    if (beforeLength <= 0 || afterLength <= 0) return [];

    if (beforeLength === 1) {
      for (let afterIndex = afterStart; afterIndex < afterEnd; afterIndex += 1) {
        if (isMatch(before[beforeStart], after[afterIndex])) return [[beforeStart, afterIndex]];
      }
      return [];
    }

    if (afterLength === 1) {
      for (let beforeIndex = beforeStart; beforeIndex < beforeEnd; beforeIndex += 1) {
        if (isMatch(before[beforeIndex], after[afterStart])) return [[beforeIndex, afterStart]];
      }
      return [];
    }

    const beforeMid = beforeStart + Math.floor(beforeLength / 2);
    const forwardScores = linearScoreRow(before, after, beforeStart, beforeMid, afterStart, afterEnd, isMatch);
    const reverseScores = linearScoreRow(before, after, beforeMid, beforeEnd, afterStart, afterEnd, isMatch, true);
    const afterMid = afterStart + bestLinearSplit(forwardScores, reverseScores);

    return [
      ...linearLcsPairsByBefore(before, after, isMatch, beforeStart, beforeMid, afterStart, afterMid),
      ...linearLcsPairsByBefore(before, after, isMatch, beforeMid, beforeEnd, afterMid, afterEnd)
    ];
  }

  function linearLcsPairs(before, after, isMatch) {
    if (after.length > before.length) {
      return linearLcsPairsByBefore(
        after,
        before,
        (afterItem, beforeItem) => isMatch(beforeItem, afterItem),
        0,
        after.length,
        0,
        before.length
      )
        .map(([afterIndex, beforeIndex]) => [beforeIndex, afterIndex])
        .sort(pairOrder);
    }

    return linearLcsPairsByBefore(before, after, isMatch, 0, before.length, 0, after.length);
  }

  function weightedScoreRow(before, after, beforeStart, beforeEnd, afterStart, afterEnd, weightForPair, reverse = false) {
    const afterLength = afterEnd - afterStart;
    let previous = Array(afterLength + 1).fill(0);
    let current = Array(afterLength + 1).fill(0);
    const beforeStep = reverse ? -1 : 1;
    let beforeIndex = reverse ? beforeEnd - 1 : beforeStart;

    while (reverse ? beforeIndex >= beforeStart : beforeIndex < beforeEnd) {
      current[0] = 0;
      for (let offset = 0; offset < afterLength; offset += 1) {
        const afterIndex = reverse ? afterEnd - 1 - offset : afterStart + offset;
        const weight = weightForPair(before[beforeIndex], after[afterIndex]);
        const matchScore = weight ? previous[offset] + weight : 0;
        current[offset + 1] = Math.max(previous[offset + 1], current[offset], matchScore);
      }

      const reusable = previous;
      previous = current;
      current = reusable;
      beforeIndex += beforeStep;
    }

    return previous;
  }

  function bestSingleWeightedBeforePair(before, after, beforeIndex, afterStart, afterEnd, weightForPair) {
    let bestAfterIndex = -1;
    let bestWeight = 0;

    for (let afterIndex = afterStart; afterIndex < afterEnd; afterIndex += 1) {
      const weight = weightForPair(before[beforeIndex], after[afterIndex]);
      if (weight > bestWeight) {
        bestWeight = weight;
        bestAfterIndex = afterIndex;
      }
    }

    return bestAfterIndex >= 0 ? [[beforeIndex, bestAfterIndex]] : [];
  }

  function bestSingleWeightedAfterPair(before, after, beforeStart, beforeEnd, afterIndex, weightForPair) {
    let bestBeforeIndex = -1;
    let bestWeight = 0;

    for (let beforeIndex = beforeStart; beforeIndex < beforeEnd; beforeIndex += 1) {
      const weight = weightForPair(before[beforeIndex], after[afterIndex]);
      if (weight > bestWeight) {
        bestWeight = weight;
        bestBeforeIndex = beforeIndex;
      }
    }

    return bestBeforeIndex >= 0 ? [[bestBeforeIndex, afterIndex]] : [];
  }

  function linearWeightedPairsByBefore(before, after, weightForPair, beforeStart, beforeEnd, afterStart, afterEnd) {
    const beforeLength = beforeEnd - beforeStart;
    const afterLength = afterEnd - afterStart;
    if (beforeLength <= 0 || afterLength <= 0) return [];

    if (beforeLength === 1) {
      return bestSingleWeightedBeforePair(before, after, beforeStart, afterStart, afterEnd, weightForPair);
    }

    if (afterLength === 1) {
      return bestSingleWeightedAfterPair(before, after, beforeStart, beforeEnd, afterStart, weightForPair);
    }

    const beforeMid = beforeStart + Math.floor(beforeLength / 2);
    const forwardScores = weightedScoreRow(before, after, beforeStart, beforeMid, afterStart, afterEnd, weightForPair);
    const reverseScores = weightedScoreRow(before, after, beforeMid, beforeEnd, afterStart, afterEnd, weightForPair, true);
    const afterMid = afterStart + bestLinearSplit(forwardScores, reverseScores);

    return [
      ...linearWeightedPairsByBefore(before, after, weightForPair, beforeStart, beforeMid, afterStart, afterMid),
      ...linearWeightedPairsByBefore(before, after, weightForPair, beforeMid, beforeEnd, afterMid, afterEnd)
    ];
  }

  function linearWeightedPairs(before, after, weightForPair) {
    if (after.length > before.length) {
      return linearWeightedPairsByBefore(
        after,
        before,
        (afterItem, beforeItem) => weightForPair(beforeItem, afterItem),
        0,
        after.length,
        0,
        before.length
      )
        .map(([afterIndex, beforeIndex]) => [beforeIndex, afterIndex])
        .sort(pairOrder);
    }

    return linearWeightedPairsByBefore(before, after, weightForPair, 0, before.length, 0, after.length);
  }

  function alignDiffBlocks(beforeBlocks, afterBlocks) {
    return linearWeightedPairs(beforeBlocks, afterBlocks, blockAlignmentWeight);
  }

  function flattenDiffBlockRange(blocks, start, end) {
    return blocks.slice(start, end).flat();
  }

  function diffBlockRangeSimilarity(beforeBlocks, afterBlocks, range) {
    return blockSimilarity(
      flattenDiffBlockRange(beforeBlocks, range.beforeStart, range.beforeEnd),
      flattenDiffBlockRange(afterBlocks, range.afterStart, range.afterEnd)
    );
  }

  function shouldExpandDiffBlockRange(currentSimilarity, candidateSimilarity) {
    const improvement = candidateSimilarity - currentSimilarity;
    if (candidateSimilarity >= 0.9 && improvement >= 0.02) return true;
    if (candidateSimilarity >= 0.68 && improvement >= 0.05) return true;
    return currentSimilarity < 0.62 && improvement >= 0.1;
  }

  function diffBlockHasMeaningfulTerms(block) {
    return meaningfulTermsForTokens(block).length > 0;
  }

  function previousDiffExpansionStart(blocks, start, limit) {
    let candidateStart = start - 1;
    while (candidateStart > limit && !diffBlockHasMeaningfulTerms(blocks[candidateStart])) {
      candidateStart -= 1;
    }
    return candidateStart;
  }

  function nextDiffExpansionEnd(blocks, end, limit) {
    let candidateEnd = end + 1;
    while (candidateEnd < limit && !diffBlockHasMeaningfulTerms(blocks[candidateEnd - 1])) {
      candidateEnd += 1;
    }
    return candidateEnd;
  }

  function expandDiffBlockPairs(pairs, beforeBlocks, afterBlocks) {
    const ranges = pairs.map(([beforeIndex, afterIndex]) => ({
      beforeStart: beforeIndex,
      beforeEnd: beforeIndex + 1,
      afterStart: afterIndex,
      afterEnd: afterIndex + 1
    }));

    let changed = true;
    let guard = beforeBlocks.length + afterBlocks.length;

    while (changed && guard > 0) {
      changed = false;
      guard -= 1;

      ranges.forEach((range, index) => {
        const prevBeforeLimit = index > 0 ? ranges[index - 1].beforeEnd : 0;
        const prevAfterLimit = index > 0 ? ranges[index - 1].afterEnd : 0;
        const nextBeforeLimit = index + 1 < ranges.length ? ranges[index + 1].beforeStart : beforeBlocks.length;
        const nextAfterLimit = index + 1 < ranges.length ? ranges[index + 1].afterStart : afterBlocks.length;
        const currentSimilarity = diffBlockRangeSimilarity(beforeBlocks, afterBlocks, range);
        let bestRange = null;
        let bestSimilarity = currentSimilarity;

        const candidates = [];
        if (range.beforeStart > prevBeforeLimit) {
          candidates.push({
            ...range,
            beforeStart: previousDiffExpansionStart(beforeBlocks, range.beforeStart, prevBeforeLimit)
          });
        }
        if (range.afterStart > prevAfterLimit) {
          candidates.push({
            ...range,
            afterStart: previousDiffExpansionStart(afterBlocks, range.afterStart, prevAfterLimit)
          });
        }
        if (range.beforeEnd < nextBeforeLimit) {
          candidates.push({
            ...range,
            beforeEnd: nextDiffExpansionEnd(beforeBlocks, range.beforeEnd, nextBeforeLimit)
          });
        }
        if (range.afterEnd < nextAfterLimit) {
          candidates.push({
            ...range,
            afterEnd: nextDiffExpansionEnd(afterBlocks, range.afterEnd, nextAfterLimit)
          });
        }

        candidates.forEach(candidate => {
          const candidateSimilarity = diffBlockRangeSimilarity(beforeBlocks, afterBlocks, candidate);
          if (
            candidateSimilarity > bestSimilarity &&
            shouldExpandDiffBlockRange(currentSimilarity, candidateSimilarity)
          ) {
            bestRange = candidate;
            bestSimilarity = candidateSimilarity;
          }
        });

        if (bestRange) {
          range.beforeStart = bestRange.beforeStart;
          range.beforeEnd = bestRange.beforeEnd;
          range.afterStart = bestRange.afterStart;
          range.afterEnd = bestRange.afterEnd;
          changed = true;
        }
      });
    }

    return ranges;
  }

  function previousSameWordIndex(parts, index) {
    for (let current = index - 1; current >= 0; current -= 1) {
      if (parts[current].type === "same" && isDiffSequenceWordText(parts[current].text)) return current;
    }

    return -1;
  }

  function nextSameWordIndex(parts, index) {
    for (let current = index + 1; current < parts.length; current += 1) {
      if (parts[current].type === "same" && isDiffSequenceWordText(parts[current].text)) return current;
      if (parts[current].type !== "same") return -1;
    }

    return -1;
  }

  function changedWordCounts(parts, start, end) {
    const counts = { added: 0, removed: 0 };

    for (let index = start; index < end; index += 1) {
      const part = parts[index];
      if ((part.type === "added" || part.type === "removed") && isDiffSequenceWordText(part.text)) {
        counts[part.type] += 1;
      }
    }

    return counts;
  }

  function shouldCoalesceReplacementSegment(segment) {
    const counts = changedWordCounts(segment, 0, segment.length);
    return counts.added >= 2 && counts.removed >= 2 && counts.added + counts.removed <= 12;
  }

  function sameWordCount(parts) {
    return parts.filter(part => part.type === "same" && isDiffSequenceWordText(part.text)).length;
  }

  function wordTokenCount(parts) {
    return parts.filter(part => isDiffSequenceWordText(part.text)).length;
  }

  function coerceDiffPartType(part, type) {
    return {
      ...part,
      type,
      beforeIndex: type === "removed" ? part.beforeIndex : undefined,
      beforeStart: type === "removed" ? part.beforeStart : undefined,
      beforeEnd: type === "removed" ? part.beforeEnd : undefined,
      afterIndex: type === "added" ? part.afterIndex : undefined,
      afterStart: type === "added" ? part.afterStart : undefined,
      afterEnd: type === "added" ? part.afterEnd : undefined
    };
  }

  function coalesceReplacementSegment(segment) {
    const removed = [];
    const added = [];
    const neutral = [];
    let sawRemoved = false;
    let sawAdded = false;

    segment.forEach(part => {
      if (part.type === "removed") {
        removed.push(part);
        if (isDiffSequenceWordText(part.text)) sawRemoved = true;
        return;
      }

      if (part.type === "added") {
        added.push(part);
        if (isDiffSequenceWordText(part.text)) sawAdded = true;
        return;
      }

      if (part.type === "same" && isDiffSequenceWhitespaceText(part.text)) {
        if (sawRemoved) removed.push(coerceDiffPartType(part, "removed"));
        if (sawAdded) added.push(coerceDiffPartType(part, "added"));
        return;
      }

      neutral.push(part);
    });

    return [...removed, ...added, ...neutral];
  }

  function coalesceInterleavedReplacementWindow(segment) {
    const removed = [];
    const added = [];

    segment.forEach(part => {
      if (part.type === "removed") {
        removed.push(part);
        return;
      }

      if (part.type === "added") {
        added.push(part);
        return;
      }

      if (part.type !== "same") return;
      removed.push(coerceDiffPartType(part, "removed"));
      added.push(coerceDiffPartType(part, "added"));
    });

    return [...removed, ...added];
  }

  function shouldCoalesceInterleavedReplacementWindow(segment) {
    const counts = changedWordCounts(segment, 0, segment.length);
    const anchors = sameWordCount(segment);
    if (counts.added < 3 || counts.removed < 3) return false;

    const words = wordTokenCount(segment);
    if (words > 18) return false;

    const changedWords = counts.added + counts.removed;
    if (!anchors) return changedWords / words >= 0.75;
    if (anchors > 5) return false;
    return changedWords / words >= 0.55;
  }

  function changedWordTypes(segment) {
    return segment
      .filter(part => isChangedDiffPart(part) && isDiffSequenceWordText(part.text))
      .map(part => part.type);
  }

  function changedWordInfos(segment) {
    return segment
      .map((part, index) => ({ part, index }))
      .filter(({ part }) => isChangedDiffPart(part) && isDiffSequenceWordText(part.text))
      .map(({ part, index }) => ({ type: part.type, index }));
  }

  function changedTypesAreCoalescableAlternation(types) {
    if (types.length < 6) return false;

    const added = types.filter(type => type === "added").length;
    const removed = types.length - added;
    if (added < 3 || removed < 3) return false;

    return types.every((type, index) => index === 0 || type !== types[index - 1]);
  }

  function alternatingChangedWordRunBounds(segment) {
    const infos = changedWordInfos(segment);
    if (infos.length < 6) return null;

    let best = null;
    let runStart = 0;
    const considerRun = end => {
      const run = infos.slice(runStart, end);
      const types = run.map(info => info.type);
      if (!changedTypesAreCoalescableAlternation(types)) return;

      if (!best || run.length > best.wordCount) {
        best = {
          start: run[0].index,
          end: run[run.length - 1].index + 1,
          wordCount: run.length
        };
      }
    };

    for (let index = 1; index <= infos.length; index += 1) {
      if (index === infos.length || infos[index].type === infos[index - 1].type) {
        considerRun(index);
        runStart = index;
      }
    }

    return best;
  }

  function coalesceAlternatingChangedWordRun(segment) {
    const bounds = alternatingChangedWordRunBounds(segment);
    if (!bounds) return segment;

    return [
      ...segment.slice(0, bounds.start),
      ...coalesceInterleavedReplacementWindow(segment.slice(bounds.start, bounds.end)),
      ...coalesceAlternatingChangedWordRun(segment.slice(bounds.end))
    ];
  }

  function coalesceAlternatingChangedWordSubsegments(segment) {
    const coalesced = [];
    let start = 0;

    for (let index = 0; index <= segment.length; index += 1) {
      const isBoundary = index === segment.length || segment[index].text === "\n";
      if (!isBoundary) continue;

      coalesced.push(...coalesceAlternatingChangedWordRun(segment.slice(start, index)));
      if (index < segment.length) coalesced.push(segment[index]);
      start = index + 1;
    }

    return coalesced;
  }

  function coalesceAlternatingChangedWordSegments(parts) {
    const coalesced = [];
    let index = 0;

    while (index < parts.length) {
      if (parts[index].type === "same" && isDiffSequenceWordText(parts[index].text)) {
        coalesced.push(parts[index]);
        index += 1;
        continue;
      }

      const segmentStart = index;
      while (
        index < parts.length &&
        !(parts[index].type === "same" && isDiffSequenceWordText(parts[index].text))
      ) {
        index += 1;
      }

      coalesced.push(...coalesceAlternatingChangedWordSubsegments(parts.slice(segmentStart, index)));
    }

    return coalesced;
  }

  function coalesceInterleavedReplacementSubsegment(segment) {
    const firstChanged = segment.findIndex(isChangedDiffPart);
    if (firstChanged < 0) return segment;

    let lastChanged = -1;
    for (let index = segment.length - 1; index >= firstChanged; index -= 1) {
      if (isChangedDiffPart(segment[index])) {
        lastChanged = index;
        break;
      }
    }

    const replacementWindow = segment.slice(firstChanged, lastChanged + 1);
    if (!shouldCoalesceInterleavedReplacementWindow(replacementWindow)) return segment;

    return [
      ...segment.slice(0, firstChanged),
      ...coalesceInterleavedReplacementWindow(replacementWindow),
      ...segment.slice(lastChanged + 1)
    ];
  }

  function coalesceInterleavedReplacementSegments(parts) {
    const coalesced = [];
    let start = 0;

    for (let index = 0; index <= parts.length; index += 1) {
      const isBoundary = index === parts.length || parts[index].text === "\n";
      if (!isBoundary) continue;

      coalesced.push(...coalesceInterleavedReplacementSubsegment(parts.slice(start, index)));
      if (index < parts.length) coalesced.push(parts[index]);
      start = index + 1;
    }

    return coalesced;
  }

  function coalesceReplacementSubsegments(segment) {
    const coalesced = [];
    let start = 0;

    for (let index = 0; index <= segment.length; index += 1) {
      const isBoundary = index === segment.length || segment[index].text === "\n";
      if (!isBoundary) continue;

      const subsegment = segment.slice(start, index);
      if (shouldCoalesceReplacementSegment(subsegment)) {
        coalesced.push(...coalesceReplacementSegment(subsegment));
      } else {
        coalesced.push(...subsegment);
      }

      if (index < segment.length) coalesced.push(segment[index]);
      start = index + 1;
    }

    return coalesced;
  }

  function coalesceReplacementSegments(parts) {
    const coalesced = [];
    let index = 0;

    while (index < parts.length) {
      const part = parts[index];

      if (part.type !== "same" || !isDiffSequenceWordText(part.text)) {
        const segmentStart = index;
        while (
          index < parts.length &&
          !(parts[index].type === "same" && isDiffSequenceWordText(parts[index].text))
        ) {
          index += 1;
        }

        coalesced.push(...coalesceReplacementSubsegments(parts.slice(segmentStart, index)));
        continue;
      }

      coalesced.push(part);
      index += 1;

      const segmentStart = index;
      while (
        index < parts.length &&
        !(parts[index].type === "same" && isDiffSequenceWordText(parts[index].text))
      ) {
        index += 1;
      }

      coalesced.push(...coalesceReplacementSubsegments(parts.slice(segmentStart, index)));
    }

    return coalesced;
  }

  function diffPartKey(part) {
    const marks = part?.marks || {};
    return [
      part?.text || "",
      marks.bold ? "b" : "",
      marks.italic ? "i" : "",
      marks.underline ? "u" : "",
      marks.strike ? "s" : ""
    ].join("|");
  }

  function sameDiffPartFromChangedPair(removedPart, addedPart) {
    return {
      ...addedPart,
      type: "same",
      marks: addedPart.marks || removedPart.marks || {},
      beforeIndex: removedPart.beforeIndex,
      beforeStart: removedPart.beforeStart,
      beforeEnd: removedPart.beforeEnd,
      afterIndex: addedPart.afterIndex,
      afterStart: addedPart.afterStart,
      afterEnd: addedPart.afterEnd
    };
  }

  function isMeaningfulCommonChangedRun(parts) {
    if (!parts.length) return false;
    const wordCount = parts.filter(part => isDiffSequenceWordText(part.text)).length;
    return wordCount >= 1;
  }

  function commonChangedPrefixLength(removed, added) {
    let length = 0;
    while (
      length < removed.length &&
      length < added.length &&
      diffPartKey(removed[length]) === diffPartKey(added[length])
    ) {
      length += 1;
    }
    return length;
  }

  function commonChangedSuffixLength(removed, added, prefixLength) {
    let length = 0;
    while (
      length < removed.length - prefixLength &&
      length < added.length - prefixLength &&
      diffPartKey(removed[removed.length - 1 - length]) === diffPartKey(added[added.length - 1 - length])
    ) {
      length += 1;
    }
    return length;
  }

  function restoreCommonChangedAffixes(segment) {
    const removed = segment.filter(part => part.type === "removed");
    const added = segment.filter(part => part.type === "added");
    if (!removed.length || !added.length) return segment;

    let prefixLength = commonChangedPrefixLength(removed, added);
    if (!isMeaningfulCommonChangedRun(removed.slice(0, prefixLength))) prefixLength = 0;

    let suffixLength = commonChangedSuffixLength(removed, added, prefixLength);
    if (!isMeaningfulCommonChangedRun(removed.slice(removed.length - suffixLength))) suffixLength = 0;

    if (!prefixLength && !suffixLength) return segment;

    const prefix = removed
      .slice(0, prefixLength)
      .map((part, index) => sameDiffPartFromChangedPair(part, added[index]));
    const suffixRemovedStart = removed.length - suffixLength;
    const suffixAddedStart = added.length - suffixLength;
    const suffix = removed
      .slice(suffixRemovedStart)
      .map((part, index) => sameDiffPartFromChangedPair(part, added[suffixAddedStart + index]));

    return [
      ...prefix,
      ...removed.slice(prefixLength, suffixRemovedStart),
      ...added.slice(prefixLength, suffixAddedStart),
      ...suffix
    ];
  }

  function shouldRestoreChangedTokenRun(segment) {
    const changedParts = segment.filter(part => part.type === "added" || part.type === "removed");
    if (!changedParts.some(part => part.type === "added")) return false;
    if (!changedParts.some(part => part.type === "removed")) return false;
    if (segment.some(part => part.type === "same")) return false;
    return changedParts.every(part => !isDiffSequenceWordText(part.text));
  }

  function diffChangedTokenRun(before, after) {
    const pairs = linearLcsPairs(before, after, (beforePart, afterPart) => diffPartKey(beforePart) === diffPartKey(afterPart));
    const result = [];
    let beforeIndex = 0;
    let afterIndex = 0;

    pairs.forEach(([matchedBeforeIndex, matchedAfterIndex]) => {
      while (beforeIndex < matchedBeforeIndex) {
        result.push(before[beforeIndex]);
        beforeIndex += 1;
      }
      while (afterIndex < matchedAfterIndex) {
        result.push(after[afterIndex]);
        afterIndex += 1;
      }

      result.push(sameDiffPartFromChangedPair(before[matchedBeforeIndex], after[matchedAfterIndex]));
      beforeIndex = matchedBeforeIndex + 1;
      afterIndex = matchedAfterIndex + 1;
    });

    while (beforeIndex < before.length) {
      result.push(before[beforeIndex]);
      beforeIndex += 1;
    }
    while (afterIndex < after.length) {
      result.push(after[afterIndex]);
      afterIndex += 1;
    }

    return result;
  }

  function restoreIdenticalChangedTokens(parts) {
    const restored = [];
    let index = 0;

    while (index < parts.length) {
      if (parts[index].type === "same") {
        restored.push(parts[index]);
        index += 1;
        continue;
      }

      const segmentStart = index;
      while (index < parts.length && parts[index].type !== "same") {
        index += 1;
      }

      const segment = parts.slice(segmentStart, index);
      const affixRestored = restoreCommonChangedAffixes(segment);
      if (affixRestored !== segment) {
        restored.push(...affixRestored);
        continue;
      }

      if (!shouldRestoreChangedTokenRun(segment)) {
        restored.push(...segment);
        continue;
      }

      restored.push(...diffChangedTokenRun(
        segment.filter(part => part.type === "removed"),
        segment.filter(part => part.type === "added")
      ));
    }

    return restored;
  }

  function shouldAbsorbWeakReplacementAnchor(parts, index) {
    const part = parts[index];
    if (part?.type !== "same" || !isDiffSequenceWordText(part.text)) return false;

    const previousIndex = previousSameWordIndex(parts, index);
    const followingIndex = nextSameWordIndex(parts, index);
    if (previousIndex < 0 || followingIndex < 0) return false;

    const counts = changedWordCounts(parts, previousIndex + 1, index);
    return counts.added >= 2 && counts.removed >= 2 && counts.added + counts.removed <= 10;
  }

  function cleanupWeakReplacementAnchors(parts) {
    const absorbIndexes = new Set();

    parts.forEach((part, index) => {
      if (!shouldAbsorbWeakReplacementAnchor(parts, index)) return;
      absorbIndexes.add(index);

      for (let current = index + 1; current < parts.length; current += 1) {
        if (parts[current].type !== "same" || !isDiffSequenceWhitespaceText(parts[current].text)) break;
        absorbIndexes.add(current);
      }
    });

    const absorbedParts = absorbIndexes.size ? parts.map((part, index) => {
      if (!absorbIndexes.has(index)) return part;
      return {
        ...part,
        type: "added",
        beforeIndex: undefined,
        beforeStart: undefined,
        beforeEnd: undefined
      };
    }) : parts;

    return restoreIdenticalChangedTokens(coalesceReplacementSegments(
      coalesceInterleavedReplacementSegments(
        coalesceAlternatingChangedWordSegments(absorbedParts)
      )
    ));
  }

  function removedPartFromToken(token, fallbackIndex) {
    return {
      type: "removed",
      text: token.text,
      marks: token.marks || {},
      beforeIndex: token.index ?? fallbackIndex,
      beforeStart: token.start,
      beforeEnd: token.end
    };
  }

  function addedPartFromToken(token, fallbackIndex) {
    return {
      type: "added",
      text: token.text,
      marks: token.marks || {},
      afterIndex: token.index ?? fallbackIndex,
      afterStart: token.start,
      afterEnd: token.end
    };
  }

  function samePartFromTokens(beforeToken, afterToken, fallbackBeforeIndex, fallbackAfterIndex) {
    return {
      type: "same",
      text: afterToken.text,
      marks: afterToken.marks || beforeToken.marks || {},
      beforeIndex: beforeToken.index ?? fallbackBeforeIndex,
      beforeStart: beforeToken.start,
      beforeEnd: beforeToken.end,
      afterIndex: afterToken.index ?? fallbackAfterIndex,
      afterStart: afterToken.start,
      afterEnd: afterToken.end
    };
  }

  function diffSequence(before, after) {
    const pairs = linearLcsPairs(before, after, (beforeToken, afterToken) => beforeToken.key === afterToken.key);
    const result = [];
    let beforeIndex = 0;
    let afterIndex = 0;

    pairs.forEach(([matchedBeforeIndex, matchedAfterIndex]) => {
      while (beforeIndex < matchedBeforeIndex) {
        result.push(removedPartFromToken(before[beforeIndex], beforeIndex));
        beforeIndex += 1;
      }
      while (afterIndex < matchedAfterIndex) {
        result.push(addedPartFromToken(after[afterIndex], afterIndex));
        afterIndex += 1;
      }

      result.push(samePartFromTokens(
        before[matchedBeforeIndex],
        after[matchedAfterIndex],
        matchedBeforeIndex,
        matchedAfterIndex
      ));
      beforeIndex = matchedBeforeIndex + 1;
      afterIndex = matchedAfterIndex + 1;
    });

    while (beforeIndex < before.length) {
      result.push(removedPartFromToken(before[beforeIndex], beforeIndex));
      beforeIndex += 1;
    }
    while (afterIndex < after.length) {
      result.push(addedPartFromToken(after[afterIndex], afterIndex));
      afterIndex += 1;
    }

    return cleanupWeakReplacementAnchors(result);
  }

  function diffUnmatchedBlock(tokens, type) {
    return tokens.map((token, index) => type === "removed"
      ? removedPartFromToken(token, index)
      : addedPartFromToken(token, index));
  }

  function diffBlocksHaveSameTokens(beforeBlock, afterBlock) {
    if (beforeBlock.length !== afterBlock.length) return false;
    return beforeBlock.every((token, index) => token.key === afterBlock[index].key);
  }

  function appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeStart, beforeEnd, afterStart, afterEnd) {
    let beforeIndex = beforeStart;
    let afterIndex = afterStart;

    while (beforeIndex < beforeEnd || afterIndex < afterEnd) {
      if (
        beforeIndex < beforeEnd &&
        afterIndex < afterEnd &&
        diffBlocksHaveSameTokens(beforeBlocks[beforeIndex], afterBlocks[afterIndex])
      ) {
        parts.push(...diffSequence(beforeBlocks[beforeIndex], afterBlocks[afterIndex]));
        beforeIndex += 1;
        afterIndex += 1;
        continue;
      }

      if (beforeIndex < beforeEnd) {
        parts.push(...diffUnmatchedBlock(beforeBlocks[beforeIndex], "removed"));
        beforeIndex += 1;
        continue;
      }

      parts.push(...diffUnmatchedBlock(afterBlocks[afterIndex], "added"));
      afterIndex += 1;
    }
  }

  function diffTokens(beforeTokens, afterTokens) {
    const beforeBlocks = splitDiffBlocks(beforeTokens);
    const afterBlocks = splitDiffBlocks(afterTokens);
    const pairs = expandDiffBlockPairs(alignDiffBlocks(beforeBlocks, afterBlocks), beforeBlocks, afterBlocks);
    const parts = [];
    let beforeIndex = 0;
    let afterIndex = 0;

    pairs.forEach(range => {
      appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeIndex, range.beforeStart, afterIndex, range.afterStart);
      parts.push(...diffSequence(
        flattenDiffBlockRange(beforeBlocks, range.beforeStart, range.beforeEnd),
        flattenDiffBlockRange(afterBlocks, range.afterStart, range.afterEnd)
      ));
      beforeIndex = range.beforeEnd;
      afterIndex = range.afterEnd;
    });

    appendUnmatchedBlockGap(parts, beforeBlocks, afterBlocks, beforeIndex, beforeBlocks.length, afterIndex, afterBlocks.length);
    return restoreIdenticalChangedTokens(parts);
  }

  function diffText(beforeText, afterText) {
    return diffTokens(tokenizeText(beforeText), tokenizeText(afterText));
  }

  function countDiffSegments(parts, type) {
    let count = 0;
    let text = "";

    const flush = () => {
      if (text.trim()) count += 1;
      text = "";
    };

    parts.forEach(part => {
      if (part.type === type) {
        text += part.text || "";
        return;
      }
      if (text) flush();
    });
    if (text) flush();

    return count;
  }

  return {
    alignDiffBlocks,
    appendUnmatchedBlockGap,
    cleanupWeakReplacementAnchors,
    countDiffSegments,
    diffBlocksHaveSameTokens,
    diffSequence,
    diffText,
    diffTextSignature,
    diffTokens,
    diffUnmatchedBlock,
    expandDiffBlockPairs,
    flattenDiffBlockRange,
    hashText,
    isChangedDiffPart,
    isDiffSequenceWhitespaceText,
    isDiffSequenceWordText,
    meaningfulTermsForTokens,
    normalizeDiffSource,
    restoreIdenticalChangedTokens,
    splitDiffBlocks,
    tokenizeText
  };
});
