import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Feather';
import {useFocusEffect} from '@react-navigation/native';

interface Props {
  image?: string | null;
  video?: string | null;
}

export default function PostMedia({image, video}: Props) {
  const [imageExpanded, setImageExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<Video>(null);

  // Pause video when screen loses focus (user navigates to another tab)
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setPlaying(false);
      };
    }, []),
  );

  if (video) {
    return (
      <View
        style={styles.videoWrap}
        onTouchStart={event => event.stopPropagation()}>
        <Video
          ref={videoRef}
          source={{uri: video}}
          style={styles.media}
          resizeMode="contain"
          controls={false}
          paused={!playing}
          onEnd={() => setPlaying(false)}
          onError={() => setPlaying(false)}
        />
        {!playing && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play video"
            style={styles.playButton}
            onPress={() => setPlaying(true)}>
            <Icon name="play-circle" size={52} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    );
  }

  if (!image) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open full-size image"
        onTouchStart={event => event.stopPropagation()}
        onPress={() => setImageExpanded(true)}
        style={styles.imagePressable}>
        <Image source={{uri: image}} style={styles.media} resizeMode="contain" />
        <View style={styles.expandHint}>
          <Text style={styles.expandHintText}>Tap to view full image</Text>
        </View>
      </Pressable>
      <Modal
        visible={imageExpanded}
        transparent
        animationType="fade"
        onRequestClose={() => setImageExpanded(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close full-size image"
          style={styles.viewer}
          onPress={() => setImageExpanded(false)}>
          <Image
            source={{uri: image}}
            style={styles.fullImage}
            resizeMode="contain"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close image"
            style={styles.closeButton}
            onPress={() => setImageExpanded(false)}>
            <Icon name="x" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  imagePressable: {
    width: '100%',
    height: 240,
    backgroundColor: '#111111',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  videoWrap: {
    width: '100%',
    height: 240,
    backgroundColor: '#111111',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  media: {width: '100%', height: '100%'},
  expandHint: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#00000099',
  },
  expandHintText: {color: '#FFFFFF', fontSize: 11},
  playButton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00000033',
  },
  viewer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  fullImage: {width: '100%', height: '100%'},
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#00000088',
  },
});
