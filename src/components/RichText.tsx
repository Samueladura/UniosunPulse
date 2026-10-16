import React from 'react';
import {
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import {colors} from '../theme/colors.ts';

const URL_REGEX = /https?:\/\/[^\s]+/g;
const HASHTAG_REGEX = /#(\w+)/g;

type Token =
  | {type: 'text'; value: string}
  | {type: 'url'; value: string}
  | {type: 'hashtag'; value: string};

function tokenize(text: string): Token[] {
  const matches: Array<{
    index: number;
    end: number;
    type: Token['type'];
    value: string;
  }> = [];

  for (const match of text.matchAll(URL_REGEX)) {
    let url = match[0];
    url = url.replace(/[.,:;!?)]+$/, '');
    matches.push({
      index: match.index!,
      end: match.index! + url.length,
      type: 'url',
      value: url,
    });
  }

  for (const match of text.matchAll(HASHTAG_REGEX)) {
    matches.push({
      index: match.index!,
      end: match.index! + match[0].length,
      type: 'hashtag',
      value: match[1],
    });
  }

  matches.sort((a, b) => a.index - b.index);

  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.index < cursor) {
      continue;
    }
    if (match.index > cursor) {
      tokens.push({type: 'text', value: text.slice(cursor, match.index)});
    }
    tokens.push({type: match.type, value: match.value});
    cursor = match.end;
  }
  if (cursor < text.length) {
    tokens.push({type: 'text', value: text.slice(cursor)});
  }
  return tokens;
}

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  onUrlPress?: (url: string) => void;
  onHashtagPress?: (tag: string) => void;
}

export default function RichText({
  text,
  style,
  onUrlPress,
  onHashtagPress,
}: Props) {
  const baseStyle = [styles.base, style];
  const tokens = tokenize(text);

  return (
    <Text style={baseStyle}>
      {tokens.map((token, index) => {
        if (token.type === 'url') {
          return (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (onUrlPress) {
                  onUrlPress(token.value);
                } else {
                  Linking.openURL(token.value).catch(() => undefined);
                }
              }}
              activeOpacity={0.85}>
              <Text style={[styles.base, styles.link]}>{token.value}</Text>
            </TouchableOpacity>
          );
        }
        if (token.type === 'hashtag') {
          return (
            <TouchableOpacity
              key={index}
              onPress={() => onHashtagPress?.(token.value)}
              activeOpacity={0.85}>
              <Text style={[styles.base, styles.hashtag]}>#{token.value}</Text>
            </TouchableOpacity>
          );
        }
        return (
          <Text key={index} style={baseStyle}>
            {token.value}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  hashtag: {
    color: colors.primary,
    fontWeight: '700',
  },
});
