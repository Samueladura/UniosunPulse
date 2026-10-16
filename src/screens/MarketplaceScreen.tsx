import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {launchImageLibrary, Asset} from 'react-native-image-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {useThemedStyles} from '../theme/PreferencesContext';
import {colors, radius, spacing, typography} from '../theme/colors.ts';
import {
  createMarketplaceListing,
  fetchMarketplaceListings,
  fetchSavedItems,
  MarketplaceListing,
  setItemSaved,
  reportMarketplaceListing,
  updateMarketplaceListing,
  updateMarketplaceListingStatus,
} from '../services/campus';
import {uploadPostMedia} from '../services/media';

type Props = NativeStackScreenProps<RootStackParamList, 'Marketplace'>;

function getStyles() {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: colors.background},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {...typography.h3, color: colors.textPrimary},
    headerSpacer: {width: 22},
    listContent: {padding: spacing.md, paddingBottom: spacing.xl},
    errorText: {
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    categoryBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    categoryText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textPrimary,
      textTransform: 'uppercase',
    },
    price: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.primary,
    },
    title: {...typography.h3, color: colors.textPrimary},
    subtitle: {
      marginTop: 6,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: spacing.sm,
    },
    metaText: {fontSize: 13, color: colors.textSecondary},
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: spacing.sm,
    },
    phoneText: {
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
    },
    phoneAction: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    phoneActionText: {fontSize: 11, fontWeight: '700', color: colors.primary},
    ctaButton: {
      marginTop: spacing.md,
      backgroundColor: colors.primary,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
    },
    ctaText: {fontSize: 12, fontWeight: '700', color: colors.white},
    photoStrip: {marginBottom: spacing.md},
    listingPhoto: {
      width: 230,
      height: 165,
      marginRight: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    sellerActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    actionLink: {fontSize: 12, fontWeight: '700', color: colors.primary},
    removeLink: {color: colors.danger},
    reportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: spacing.md,
    },
    reportText: {fontSize: 12, color: colors.textSecondary},
    modalBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    formCard: {
      backgroundColor: colors.card,
      padding: spacing.md,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      gap: spacing.sm,
    },
    formHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    formTitle: {...typography.h3, color: colors.textPrimary},
    formInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      backgroundColor: colors.background,
    },
    formDescription: {minHeight: 78, textAlignVertical: 'top'},
    imageLabel: {fontSize: 13, color: colors.textPrimary, fontWeight: '700'},
    photoPreviewWrap: {position: 'relative', marginRight: spacing.sm},
    photoPreview: {width: 76, height: 76, borderRadius: radius.sm},
    removePhoto: {
      position: 'absolute',
      top: 3,
      right: 3,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.danger,
    },
    addPhoto: {
      width: 76,
      height: 76,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    reasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 5,
    },
    publishButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      padding: spacing.md,
      marginTop: spacing.xs,
    },
    publishText: {color: colors.white, fontWeight: '700'},
    disabledButton: {opacity: 0.55},
  });
}

function getBadgeColor(category: string, C: typeof colors): string {
  switch (category) {
    case 'Textbooks':
      return C.tagAnnouncements;
    case 'Electronics':
      return C.tagCampusLife;
    case 'Fashion':
      return C.tagEvents;
    default:
      return C.surface;
  }
}

export default function MarketplaceScreen({navigation}: Props) {
  const styles = useThemedStyles(getStyles);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MarketplaceListing | null>(null);
  const [selectedImages, setSelectedImages] = useState<Asset[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [reportTarget, setReportTarget] = useState<MarketplaceListing | null>(
    null,
  );
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const [listingRows, savedRows] = await Promise.all([
        fetchMarketplaceListings(),
        fetchSavedItems(),
      ]);
      setListings(listingRows);
      setSaved(
        Object.fromEntries(
          savedRows
            .filter(item => item.item_type === 'marketplace')
            .map(item => [item.item_id, true]),
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load marketplace listings.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadListings();
    }, [loadListings]),
  );

  const handleSave = async (item: MarketplaceListing) => {
    setBusyId(item.id);
    setError(null);
    try {
      const result = await setItemSaved(
        'marketplace',
        item.id,
        !saved[item.id],
      );
      setSaved(current => ({...current, [item.id]: result.saved}));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update saved listings.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkSold = (item: MarketplaceListing) => {
    Alert.alert(
      'Mark listing as sold?',
      'This will remove the listing from the active marketplace.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Mark sold',
          onPress: async () => {
            setBusyId(item.id);
            setError(null);
            try {
              await updateMarketplaceListingStatus(item.id, 'sold');
              setListings(current =>
                current.filter(listing => listing.id !== item.id),
              );
            } catch (requestError) {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : 'Unable to update this listing.',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleRemoveListing = (item: MarketplaceListing) => {
    Alert.alert(
      'Remove listing?',
      'This will hide your listing from the marketplace.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(item.id);
            try {
              await updateMarketplaceListingStatus(item.id, 'removed');
              setListings(current =>
                current.filter(listing => listing.id !== item.id),
              );
            } catch (requestError) {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : 'Unable to remove this listing.',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleReport = (item: MarketplaceListing) => {
    setReportTarget(item);
    setReportReason('');
    setReportDetails('');
    setShowReport(true);
  };

  const submitReport = async () => {
    if (!reportTarget || !reportReason) {
      setError('Choose a reason before submitting the report.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reportMarketplaceListing(
        reportTarget.id,
        reportReason,
        reportDetails.trim(),
      );
      setShowReport(false);
      setReportTarget(null);
      Alert.alert(
        'Report submitted',
        'Thank you for helping keep the marketplace safe.',
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to submit this report.',
      );
    } finally {
      setSaving(false);
    }
  };

  const openListingForm = (item?: MarketplaceListing) => {
    setEditing(item ?? null);
    setTitle(item?.title ?? '');
    setDescription(item?.description ?? '');
    setCategory(item?.category ?? '');
    setPrice(item ? String(item.price) : '');
    setLocation(item?.location ?? '');
    setPhone(item?.contact_phone ?? '');
    setSelectedImages([]);
    setExistingImages(item?.image_urls ?? []);
    setError(null);
    setShowForm(true);
  };

  const copyPhone = async (number: string | null) => {
    if (!number) {
      return;
    }
    try {
      await Clipboard.setString(number);
      Alert.alert('Copied', 'Phone number copied to clipboard.');
    } catch {
      Alert.alert('Unable to copy number.');
    }
  };

  const callPhone = (number: string | null) => {
    if (!number) {
      return;
    }
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Unable to start a call on this device.'),
    );
  };

  const PHONE_REGEX = /^\+?[\d\s-]{7,25}$/;

  const chooseListingImages = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 5,
      quality: 0.8,
    });
    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      setError(response.errorMessage || 'Unable to open your photo library.');
      return;
    }
    const chosen = response.assets ?? [];
    const slots = Math.max(0, 5 - existingImages.length);
    setSelectedImages(chosen.filter(asset => asset.uri).slice(0, slots));
  };

  const handleSaveListing = async () => {
    const parsedPrice = Number(price);
    if (
      title.trim().length < 3 ||
      !category.trim() ||
      !location.trim() ||
      price.trim() === '' ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      (phone.trim() && !PHONE_REGEX.test(phone))
    ) {
      setError(
        phone.trim() && !PHONE_REGEX.test(phone)
          ? 'Enter a valid phone number (e.g. +234 801 234 5678).'
          : 'Enter a title, category, non-negative price, and pickup location.',
      );
      return;
    }
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setUploadingImages(selectedImages.length > 0);
      const uploadedImages: string[] = [];
      for (const asset of selectedImages) {
        const uploaded = await uploadPostMedia(asset, 'marketplace');
        if (uploaded.image) {
          uploadedImages.push(uploaded.image);
        }
      }
      const payload = {
        title,
        description,
        category,
        price: parsedPrice,
        location,
        contact_phone: phone.trim() || undefined,
        image_urls: [...existingImages, ...uploadedImages],
      };
      if (editing) {
        const updated = await updateMarketplaceListing(editing.id, payload);
        setListings(current =>
          current.map(item => (item.id === updated.id ? updated : item)),
        );
      } else {
        const created = await createMarketplaceListing(payload);
        setListings(current => [created, ...current]);
      }
      setShowForm(false);
      setEditing(null);
      setTitle('');
      setDescription('');
      setCategory('');
      setPrice('');
      setLocation('');
      setPhone('');
      setExistingImages([]);
      setSelectedImages([]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to publish this listing.',
      );
    } finally {
      setUploadingImages(false);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marketplace</Text>
        <TouchableOpacity onPress={() => openListingForm()}>
          <Icon name="plus" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={listings}
        contentContainerStyle={styles.listContent}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadListings} />
        }
        ListHeaderComponent={
          error ? <Text style={styles.errorText}>{error}</Text> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>
              No active listings yet. Add the first one.
            </Text>
          )
        }
        renderItem={({item}) => (
          <View style={styles.card}>
            {item.image_urls?.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoStrip}>
                {item.image_urls.map((url, index) => (
                  <Image
                    key={`${url}-${index}`}
                    source={{uri: url}}
                    style={styles.listingPhoto}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            ) : null}
            <View style={styles.topRow}>
              <View
                style={[
                  styles.categoryBadge,
                  {backgroundColor: getBadgeColor(item.category, colors)},
                ]}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
              <Text style={styles.price}>₦{item.price.toLocaleString()}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.description}</Text>

            <View style={styles.metaRow}>
              <Icon name="user" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                {item.seller}
                {item.seller_id
                  ? ` • ${new Date(item.created_at).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Icon name="map-pin" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>

            {item.contact_phone && (
              <View style={styles.phoneRow}>
                <Icon name="phone" size={14} color={colors.textSecondary} />
                <Text style={styles.phoneText}>{item.contact_phone}</Text>
                <TouchableOpacity
                  style={styles.phoneAction}
                  onPress={() => copyPhone(item.contact_phone)}>
                  <Text style={styles.phoneActionText}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.phoneAction}
                  onPress={() => callPhone(item.contact_phone)}>
                  <Text style={styles.phoneActionText}>Call</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.ctaButton}
              activeOpacity={0.85}
              disabled={busyId === item.id}
              onPress={() =>
                item.is_owner ? handleMarkSold(item) : handleSave(item)
              }>
              <Icon
                name={item.is_owner ? 'check-circle' : 'bookmark'}
                size={14}
                color={colors.white}
              />
              <Text style={styles.ctaText}>
                {item.is_owner
                  ? 'Mark sold'
                  : saved[item.id]
                  ? 'Saved'
                  : 'Save listing'}
              </Text>
            </TouchableOpacity>
            {item.is_owner ? (
              <View style={styles.sellerActions}>
                <TouchableOpacity onPress={() => openListingForm(item)}>
                  <Text style={styles.actionLink}>Edit listing</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveListing(item)}>
                  <Text style={[styles.actionLink, styles.removeLink]}>
                    Remove listing
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => handleReport(item)}>
                <Icon name="flag" size={13} color={colors.textSecondary} />
                <Text style={styles.reportText}>Report listing</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editing ? 'Edit listing' : 'Create a listing'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Icon name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.formInput}
              placeholder="Item title"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <TextInput
              style={[styles.formInput, styles.formDescription]}
              placeholder="Description"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Category (e.g. Textbooks)"
              placeholderTextColor={colors.textMuted}
              value={category}
              onChangeText={setCategory}
              maxLength={40}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Price in NGN"
              placeholderTextColor={colors.textMuted}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.formInput}
              placeholder="Pickup location"
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
              maxLength={120}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Seller phone (e.g. +234 801 234 5678)"
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              maxLength={25}
            />
            <Text style={styles.imageLabel}>Listing photos (up to 5)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                ...existingImages,
                ...selectedImages.map(asset => asset.uri || ''),
              ]
                .filter(Boolean)
                .map((uri, index) => (
                  <View key={`${uri}-${index}`} style={styles.photoPreviewWrap}>
                    <Image source={{uri}} style={styles.photoPreview} />
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => {
                        if (index < existingImages.length) {
                          setExistingImages(current =>
                            current.filter(
                              (_, imageIndex) => imageIndex !== index,
                            ),
                          );
                        } else {
                          const selectedIndex = index - existingImages.length;
                          setSelectedImages(current =>
                            current.filter(
                              (_, imageIndex) => imageIndex !== selectedIndex,
                            ),
                          );
                        }
                      }}>
                      <Icon name="x" size={14} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              <TouchableOpacity
                style={styles.addPhoto}
                disabled={existingImages.length + selectedImages.length >= 5}
                onPress={() => chooseListingImages()}>
                <Icon name="camera" size={20} color={colors.primary} />
                <Text style={styles.actionLink}>Add photos</Text>
              </TouchableOpacity>
            </ScrollView>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.publishButton, saving && styles.disabledButton]}
              disabled={saving}
              onPress={handleSaveListing}>
              <Text style={styles.publishText}>
                {saving
                  ? uploadingImages
                    ? 'Uploading photos...'
                    : 'Saving...'
                  : editing
                  ? 'Save changes'
                  : 'Publish listing'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showReport}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReport(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Report listing</Text>
              <TouchableOpacity onPress={() => setShowReport(false)}>
                <Icon name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {[
              'Prohibited item',
              'Fraud or scam',
              'Misleading listing',
              'Inappropriate content',
              'Other',
            ].map(reason => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonRow}
                onPress={() => setReportReason(reason)}>
                <Icon
                  name={reportReason === reason ? 'check-circle' : 'circle'}
                  size={17}
                  color={
                    reportReason === reason ? colors.primary : colors.textMuted
                  }
                />
                <Text style={styles.metaText}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.formInput, styles.formDescription]}
              placeholder="Additional details (optional)"
              placeholderTextColor={colors.textMuted}
              value={reportDetails}
              onChangeText={setReportDetails}
              maxLength={1000}
              multiline
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <TouchableOpacity
              style={[styles.publishButton, saving && styles.disabledButton]}
              disabled={saving}
              onPress={() => submitReport()}>
              <Text style={styles.publishText}>
                {saving ? 'Submitting...' : 'Submit report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
