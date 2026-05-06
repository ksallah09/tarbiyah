import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  Image,
  Animated,
  Dimensions,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import { getSavedInsights, unsaveInsight } from '../utils/savedInsights';
import { getSavedResources, saveResource, unsaveResource } from '../utils/savedResources';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import {
  loadCommunities,
  fetchMosqueSocialLinks, saveMosqueSocialLinks,
} from '../utils/communityEvents';
let Location = null;
try { Location = require('expo-location'); } catch {}
let WebView = null;
try { WebView = require('react-native-webview').WebView; } catch {}

const API_URL = 'https://tarbiyah-production.up.railway.app';

const CATEGORIES = ['All', 'Video', 'Article/Book', 'Activity/Printable', 'Duas & Adhkar', 'Podcast', 'Other'];

const CATEGORY_CONFIG = {
  'Video':      { color: '#2E7D62', icon: 'play-circle-outline' },
  'Article/Book':       { color: '#D4871A', icon: 'book-outline' },
  'Activity/Printable': { color: '#7C3AED', icon: 'color-palette-outline' },
  'Duas & Adhkar':      { color: '#0D9488', icon: 'sparkles' },
  'Podcast':            { color: '#2563EB', icon: 'mic-outline' },
  'Other':              { color: '#6B7280', icon: 'grid-outline' },
};
function catConfig(category) {
  return CATEGORY_CONFIG[category] ?? { color: '#6B7280', icon: 'grid-outline' };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
const AGE_RANGES = ['All Ages', 'Toddler (0–3)', 'Young Child (4–7)', 'Pre-teen (8–11)', 'Teen (12+)'];

const RESOURCES_CACHE_KEY = 'tarbiyah_community_resources_cache';

const REFLECTION_TAGS = [
  'Worked for us',
  'Takes consistency',
  'Better for older kids',
  'Great for toddlers',
  'Quick read/watch',
  'Watch together',
];

const COMMUNITY_HADITHS = [
  "The most beloved people to Allah are those who are most beneficial to people.",
  "Do not belittle any act of kindness.",
  "The believer to another believer is like a building; each part strengthens the other.",
  "Allah is in the aid of His servant as long as the servant is in the aid of his brother.",
];

const LOADING_MESSAGES = [
  'Gathering wisdom from the community…',
  'Parents helping parents…',
  'Finding resources for your family…',
  'Collecting shared knowledge…',
  'Loading community favorites…',
  'Bringing you the best from Muslim parents…',
];

function ResourcesLoadingView() {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    let idx = 0;
    function cycle() {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setMsgIndex(idx);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }
    const interval = setInterval(cycle, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.empty}>
      <ActivityIndicator size="large" color="#1B3D2F" />
      <Animated.Text style={[styles.loadingMsg, { opacity: fadeAnim }]}>
        {LOADING_MESSAGES[msgIndex]}
      </Animated.Text>
    </View>
  );
}

function ResourceThumb({ uri, accentColor, cardStyle, accentStyle, onHide }) {
  return (
    <>
      <Image
        source={{ uri }}
        style={cardStyle}
        resizeMode="cover"
        onError={onHide}
        onLoad={e => {
          const { width, height } = e.nativeEvent.source;
          if (width < 100 || height < 100) onHide();
        }}
      />
      <View style={[accentStyle, { backgroundColor: accentColor }]} />
    </>
  );
}

export default function LibraryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('resources');
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeHintX = useRef(new Animated.Value(0)).current;
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;

  // ── My Library ──
  const [insights, setInsights]           = useState([]);
  const [savedResources, setSavedResources] = useState([]);
  const [query, setQuery]                 = useState('');
  const [activeTopic, setActiveTopic]     = useState('All');

  // ── Community ──
  const [resources, setResources]             = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory]   = useState('All');
  const [activeAge, setActiveAge]             = useState('All Ages');
  const [myRecommendations, setMyRecommendations] = useState(new Set());
  const [mySavedIds, setMySavedIds]           = useState(new Set());
  const [currentUserId, setCurrentUserId]     = useState(null);
  const [hiddenThumbs, setHiddenThumbs]       = useState(new Set());

  // ── Local community ──
  const [communities,       setCommunities]       = useState([]);
  const [localLoading,      setLocalLoading]      = useState(false);
  const [activeCirle,       setActiveCircle]      = useState(null);
  const [mosqueSocial,      setMosqueSocial]      = useState({});

  // ── New activity dots ──
  const [showDuaDot,      setShowDuaDot]      = useState(false);
  const [showWinsDot,     setShowWinsDot]     = useState(false);
  const [showRequestsDot, setShowRequestsDot] = useState(false);

  // ── Community notifications ──
  const [communityNotif, setCommunityNotif] = useState(true);
  const [showCommSplash,  setShowCommSplash]  = useState(false);

  // ── Resource Requests ──
  const [requests,           setRequests]           = useState([]);
  const [requestsLoading,    setRequestsLoading]    = useState(false);
  const [requestsRefreshing, setRequestsRefreshing] = useState(false);
  const [showPostRequest,    setShowPostRequest]     = useState(false);
  const [reqTitle,           setReqTitle]           = useState('');
  const [reqDesc,            setReqDesc]            = useState('');
  const [reqAnon,            setReqAnon]            = useState(false);
  const [reqSubmitting,      setReqSubmitting]       = useState(false);
  const [reqError,           setReqError]           = useState('');
  const [reqSuccess,         setReqSuccess]         = useState(false);
  const [requestDetail,      setRequestDetail]      = useState(null);
  const [requestReplies,     setRequestReplies]     = useState([]);
  const [repliesLoading,     setRepliesLoading]     = useState(false);
  const [myReplyReactions,   setMyReplyReactions]   = useState({});
  const [showReplyForm,      setShowReplyForm]      = useState(false);
  const [replyUrl,           setReplyUrl]           = useState('');
  const [replyTitle,         setReplyTitle]         = useState('');
  const [replyCategory,      setReplyCategory]      = useState('Video');
  const [replyComment,       setReplyComment]       = useState('');
  const [replySubmitting,    setReplySubmitting]    = useState(false);
  const [replyError,         setReplyError]         = useState('');
  const [replyFetchingMeta,  setReplyFetchingMeta]  = useState(false);
  const [warnTarget,         setWarnTarget]         = useState(null);
  const [warnText,           setWarnText]           = useState('');
  const replyMetaDebounce = useRef(null);

  // ── Loading overlay ──
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const overlayTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const overlayBtnOpacity = useRef(new Animated.Value(0)).current;
  const overlayActiveRef = useRef(false);
  const [overlayHadith, setOverlayHadith] = useState(COMMUNITY_HADITHS[0]);

  function showLoadingOverlay() {
    overlayActiveRef.current = true;
    setOverlayReady(false);
    overlayBtnOpacity.setValue(0);
    setOverlayHadith(COMMUNITY_HADITHS[Math.floor(Math.random() * COMMUNITY_HADITHS.length)]);
    setOverlayVisible(true);
    overlayTranslateY.setValue(SCREEN_HEIGHT);
    Animated.spring(overlayTranslateY, {
      toValue: 0,
      tension: 60,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }

  function hideLoadingOverlay() {
    if (!overlayActiveRef.current) return;
    setOverlayReady(true);
    Animated.timing(overlayBtnOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }

  function dismissOverlay() {
    overlayActiveRef.current = false;
    setOverlayReady(false);
    Animated.timing(overlayTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 480,
      useNativeDriver: true,
    }).start(() => setOverlayVisible(false));
  }

  useEffect(() => {
    if (!resourcesLoading) hideLoadingOverlay();
  }, [resourcesLoading]);

  // ── My Posts ──
  const [myPosts, setMyPosts]               = useState([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [myPostsRefreshing, setMyPostsRefreshing] = useState(false);

  // ── User profile name ──
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('tarbiyah_profile')
      .then(raw => { if (raw) { const p = JSON.parse(raw); setProfileName(p.name ?? ''); } })
      .catch(() => {});

    AsyncStorage.getItem('tarbiyah_community_hint_seen').then(seen => {
      if (seen) return;
      setShowSwipeHint(true);
      AsyncStorage.setItem('tarbiyah_community_hint_seen', '1');
      // Fade in, bounce left-right 3×, fade out
      Animated.sequence([
        Animated.timing(swipeHintOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(swipeHintX, { toValue: 10, duration: 300, useNativeDriver: true }),
            Animated.timing(swipeHintX, { toValue: -10, duration: 300, useNativeDriver: true }),
            Animated.timing(swipeHintX, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          { iterations: 3 }
        ),
        Animated.timing(swipeHintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setShowSwipeHint(false));
    });
  }, []);

  // ── Du'a Board ──
  const [duas, setDuas]                 = useState([]);
  const [duasLoading, setDuasLoading]   = useState(false);
  const [duasRefreshing, setDuasRefreshing] = useState(false);
  const [myDuaReactions, setMyDuaReactions] = useState([]); // [{dua_id, type}]
  const [showDuaSubmit, setShowDuaSubmit]   = useState(false);
  const [editingDua, setEditingDua]         = useState(null);
  const [duaTitle, setDuaTitle]             = useState('');
  const [duaText, setDuaText]               = useState('');
  const [duaAnon, setDuaAnon]               = useState(false);
  const [duaSubmitting, setDuaSubmitting]   = useState(false);
  const [duaSuccess, setDuaSuccess]         = useState(false);
  const [duaError, setDuaError]             = useState('');

  // ── Parenting Wins ──
  const [wins, setWins]                 = useState([]);
  const [winsLoading, setWinsLoading]   = useState(false);
  const [winsRefreshing, setWinsRefreshing] = useState(false);
  const [myWinReactions, setMyWinReactions] = useState(new Set());
  const [showWinSubmit, setShowWinSubmit]   = useState(false);
  const [editingWin, setEditingWin]         = useState(null);
  const [winTitle, setWinTitle]             = useState('');
  const [winText, setWinText]               = useState('');
  const [winAnon, setWinAnon]               = useState(false);
  const [winSubmitting, setWinSubmitting]   = useState(false);
  const [winSuccess, setWinSuccess]         = useState(false);
  const [winError, setWinError]             = useState('');

  // ── Edit mode ──
  const [editingResource, setEditingResource] = useState(null);

  // ── Submit modal ──
  const [showSubmit, setShowSubmit]     = useState(false);
  const [submitUrl, setSubmitUrl]       = useState('');
  const [submitTitle, setSubmitTitle]   = useState('');
  const [submitDesc, setSubmitDesc]     = useState('');
  const [submitCategory, setSubmitCategory] = useState('Video');
  const [submitAge, setSubmitAge]       = useState('All Ages');
  const [submitWhy, setSubmitWhy]       = useState('');
  const [submitTags, setSubmitTags]     = useState([]);
  const [submitThumbnail, setSubmitThumbnail]         = useState('');
  const [submitIncludeThumbnail, setSubmitIncludeThumbnail] = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [fetchingMeta, setFetchingMeta]   = useState(false);
  const metaDebounceRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      showLoadingOverlay();
      getSavedInsights().then(setInsights);
      getSavedResources().then(list => {
        setSavedResources(list);
        setMySavedIds(new Set(list.map(r => r.id)));
      });
      supabase.auth.getSession().then(({ data }) => {
        setCurrentUserId(data?.session?.user?.id ?? null);
      });
      // Load community notification preference
      AsyncStorage.getItem('tarbiyah_community_notifications').then(val => {
        setCommunityNotif(val === null ? true : val === 'true');
      });
      // Show community splash only on first ever visit
      AsyncStorage.getItem('tarbiyah_community_welcome_v1').then(seen => {
        if (!seen) setShowCommSplash(true);
      });
      loadLocalData();
      fetchResources();
      fetchMyPosts();
      fetchDuas();
      fetchWins();
      fetchRequests();
    }, [])
  );

  // Filter changes reload silently — no overlay
  const isFirstFocus = useRef(true);
  useEffect(() => {
    if (isFirstFocus.current) { isFirstFocus.current = false; return; }
    fetchResources();
  }, [activeCategory, activeAge]);

  useEffect(() => {
    if (activeTab !== 'local') return;
    loadLocalData();
  }, [activeTab]);

  // Fetch social links when a specific mosque is selected
  useEffect(() => {
    if (!activeCirle) return;
    if (mosqueSocial[activeCirle] !== undefined) return;
    setMosqueSocial(prev => ({ ...prev, [activeCirle]: null })); // mark as in-flight
    fetchMosqueSocialLinks(activeCirle).then(links => {
      setMosqueSocial(prev => ({ ...prev, [activeCirle]: links }));
    });
  }, [activeCirle]);

  async function loadLocalData() {
    setLocalLoading(true);
    try {
      const comms = await loadCommunities();
      setCommunities(comms);
      if (comms.length > 0) {
        setActiveCircle(prev => prev ?? comms[0].placeId);
      }
    } catch (e) { console.warn('[local]', e); }
    setLocalLoading(false);
  }

  useEffect(() => {
    const url = submitUrl.trim();
    if (!url.startsWith('http')) return;
    clearTimeout(metaDebounceRef.current);
    metaDebounceRef.current = setTimeout(async () => {
      setFetchingMeta(true);
      try {
        const res = await fetch(`${API_URL}/community/metadata?url=${encodeURIComponent(url)}`);
        const { title, description, thumbnail } = await res.json();
        if (title) setSubmitTitle(prev => prev || title);
        if (description) setSubmitDesc(prev => prev || description);
        if (thumbnail) { setSubmitThumbnail(thumbnail); setSubmitIncludeThumbnail(true); }
      } catch {}
      finally { setFetchingMeta(false); }
    }, 600);
    return () => clearTimeout(metaDebounceRef.current);
  }, [submitUrl]);

  useEffect(() => {
    const url = replyUrl.trim();
    if (!url.startsWith('http')) return;
    clearTimeout(replyMetaDebounce.current);
    replyMetaDebounce.current = setTimeout(async () => {
      setReplyFetchingMeta(true);
      try {
        const res = await fetch(`${API_URL}/community/metadata?url=${encodeURIComponent(url)}`);
        const { title } = await res.json();
        if (title) setReplyTitle(prev => prev || title);
      } catch {}
      finally { setReplyFetchingMeta(false); }
    }, 600);
    return () => clearTimeout(replyMetaDebounce.current);
  }, [replyUrl]);

  async function fetchResources(isPullRefresh = false) {
    // Load cache instantly on first load (not pull-to-refresh)
    if (!isPullRefresh) {
      try {
        const cached = await AsyncStorage.getItem(RESOURCES_CACHE_KEY);
        if (cached) {
          const { data: cachedData, category, age } = JSON.parse(cached);
          if (category === activeCategory && age === activeAge) {
            setResources(cachedData);
            setResourcesLoading(false);
          }
        }
      } catch {}
    }

    isPullRefresh ? setRefreshing(true) : setResourcesLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'All') params.set('category', activeCategory);
      if (activeAge !== 'All Ages') params.set('age', activeAge);
      const res = await fetch(`${API_URL}/community/resources?${params}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setResources(list);

      // Persist to cache (only for unfiltered view to keep it simple)
      if (activeCategory === 'All' && activeAge === 'All Ages') {
        AsyncStorage.setItem(RESOURCES_CACHE_KEY, JSON.stringify({
          data: list, category: activeCategory, age: activeAge,
        }));
      }

      // Fetch user's recommendations
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const recRes = await fetch(`${API_URL}/community/resources/my-recommendations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const recData = await recRes.json();
        setMyRecommendations(new Set(Array.isArray(recData) ? recData : []));
      }
    } catch {}
    finally {
      setResourcesLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchMyPosts(isPullRefresh = false) {
    isPullRefresh ? setMyPostsRefreshing(true) : setMyPostsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) { setMyPosts([]); return; }
      const res = await fetch(`${API_URL}/community/my-posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setMyPosts([
          ...(data.resources ?? []).map(r => ({ ...r, _kind: 'resource' })),
          ...(data.duas ?? []).map(d => ({ ...d, _kind: 'dua' })),
          ...(data.wins ?? []).map(w => ({ ...w, _kind: 'win' })),
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } else {
        setMyPosts([]);
      }
    } catch {
      setMyPosts([]);
    } finally {
      setMyPostsLoading(false);
      setMyPostsRefreshing(false);
    }
  }

  async function fetchDuas(isPullRefresh = false) {
    isPullRefresh ? setDuasRefreshing(true) : setDuasLoading(true);
    try {
      const res = await fetch(`${API_URL}/community/duas`);
      const data = await res.json();
      const duas = Array.isArray(data) ? data : [];
      setDuas(duas);
      if (duas.length > 0) {
        const newest = duas[0].created_at;
        const lastVisited = await AsyncStorage.getItem('tarbiyah_last_visited_dua');
        setShowDuaDot(!lastVisited || newest > lastVisited);
      }
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const rRes = await fetch(`${API_URL}/community/duas/my-reactions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rData = await rRes.json();
        setMyDuaReactions(Array.isArray(rData) ? rData : []);
      }
    } catch {} finally {
      setDuasLoading(false);
      setDuasRefreshing(false);
    }
  }

  async function fetchWins(isPullRefresh = false) {
    isPullRefresh ? setWinsRefreshing(true) : setWinsLoading(true);
    try {
      const res = await fetch(`${API_URL}/community/wins`);
      const data = await res.json();
      const wins = Array.isArray(data) ? data : [];
      setWins(wins);
      if (wins.length > 0) {
        const newest = wins[0].created_at;
        const lastVisited = await AsyncStorage.getItem('tarbiyah_last_visited_wins');
        setShowWinsDot(!lastVisited || newest > lastVisited);
      }
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        const rRes = await fetch(`${API_URL}/community/wins/my-reactions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rData = await rRes.json();
        setMyWinReactions(new Set(Array.isArray(rData) ? rData : []));
      }
    } catch {} finally {
      setWinsLoading(false);
      setWinsRefreshing(false);
    }
  }

  async function fetchRequests(isPullRefresh = false) {
    isPullRefresh ? setRequestsRefreshing(true) : setRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/community/requests`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRequests(list);
      if (list.length > 0) {
        const newest = list[0].created_at;
        const lastVisited = await AsyncStorage.getItem('tarbiyah_last_visited_requests');
        setShowRequestsDot(!lastVisited || newest > lastVisited);
      }
    } catch {} finally {
      setRequestsLoading(false);
      setRequestsRefreshing(false);
    }
  }

  async function handlePostRequest() {
    if (!reqTitle.trim() || !reqDesc.trim()) { setReqError('Please fill in both fields.'); return; }
    setReqSubmitting(true); setReqError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const profile = await AsyncStorage.getItem('tarbiyah_profile');
      const displayName = profile ? (JSON.parse(profile).name ?? 'Parent') : 'Parent';
      const res = await fetch(`${API_URL}/community/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: reqTitle.trim(), description: reqDesc.trim(), displayName: reqAnon ? null : displayName, isAnonymous: reqAnon }),
      });
      const data = await res.json();
      if (!res.ok) { setReqError(data.error ?? 'Could not submit. Please try again.'); return; }
      setReqSuccess(true);
      setRequests(prev => [data, ...prev]);
    } catch { setReqError('Something went wrong. Please try again.'); }
    finally { setReqSubmitting(false); }
  }

  async function openRequestDetail(request) {
    setRequestDetail(request);
    setRepliesLoading(true);
    try {
      const [repRes, myRes] = await Promise.all([
        fetch(`${API_URL}/community/requests/${request.id}/replies`),
        (async () => {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          if (!token) return null;
          return fetch(`${API_URL}/community/requests/replies/my-reactions`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        })(),
      ]);
      const replies = await repRes.json();
      setRequestReplies(Array.isArray(replies) ? replies : []);
      if (myRes) {
        const myData = await myRes.json();
        const map = {};
        (Array.isArray(myData) ? myData : []).forEach(r => { map[r.reply_id] = r.type; });
        setMyReplyReactions(map);
      }
    } catch {} finally { setRepliesLoading(false); }
  }

  async function handleSubmitReply() {
    if (!replyUrl.trim()) { setReplyError('URL is required.'); return; }
    setReplySubmitting(true); setReplyError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const profile = await AsyncStorage.getItem('tarbiyah_profile');
      const displayName = profile ? (JSON.parse(profile).name ?? 'Parent') : 'Parent';
      const res = await fetch(`${API_URL}/community/requests/${requestDetail.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: replyUrl.trim(), title: replyTitle.trim(), category: replyCategory, comment: replyComment.trim(), displayName }),
      });
      const data = await res.json();
      if (!res.ok) { setReplyError(data.error ?? 'Could not submit.'); return; }
      setRequestReplies(prev => [...prev, data]);
      setRequests(prev => prev.map(r => r.id === requestDetail.id ? { ...r, reply_count: (r.reply_count ?? 0) + 1 } : r));
      setRequestDetail(prev => ({ ...prev, reply_count: (prev.reply_count ?? 0) + 1 }));
      setShowReplyForm(false);
      setReplyUrl(''); setReplyTitle(''); setReplyCategory('Video'); setReplyComment(''); setReplyError('');
    } catch { setReplyError('Something went wrong.'); }
    finally { setReplySubmitting(false); }
  }

  async function handleReplyReact(reply, type, warnComment) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    const prev = myReplyReactions[reply.id];
    const toggling = prev === type;
    setMyReplyReactions(cur => ({ ...cur, [reply.id]: toggling ? null : type }));
    setRequestReplies(list => list.map(r => {
      if (r.id !== reply.id) return r;
      let agree = r.agree_count ?? 0;
      let warn = r.warn_count ?? 0;
      if (prev === 'agree') agree--; else if (prev === 'warn') warn--;
      if (!toggling) { if (type === 'agree') agree++; else warn++; }
      return { ...r, agree_count: agree, warn_count: warn };
    }));
    try {
      await fetch(`${API_URL}/community/requests/replies/${reply.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, warnComment }),
      });
    } catch {}
  }

  async function handleDuaReact(dua, type) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    const hadReaction = myDuaReactions.some(r => r.dua_id === dua.id && r.type === type);
    setMyDuaReactions(prev => hadReaction
      ? prev.filter(r => !(r.dua_id === dua.id && r.type === type))
      : [...prev, { dua_id: dua.id, type }]
    );
    setDuas(prev => prev.map(d => d.id === dua.id ? {
      ...d,
      made_dua_count: type === 'made_dua' ? d.made_dua_count + (hadReaction ? -1 : 1) : d.made_dua_count,
      feel_you_count: type === 'feel_you' ? d.feel_you_count + (hadReaction ? -1 : 1) : d.feel_you_count,
    } : d));
    try {
      await fetch(`${API_URL}/community/duas/${dua.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type }),
      });
    } catch {}
  }

  async function handleWinReact(win) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;
    const hadReaction = myWinReactions.has(win.id);
    setMyWinReactions(prev => { const next = new Set(prev); hadReaction ? next.delete(win.id) : next.add(win.id); return next; });
    setWins(prev => prev.map(w => w.id === win.id ? { ...w, heart_count: w.heart_count + (hadReaction ? -1 : 1) } : w));
    try {
      await fetch(`${API_URL}/community/wins/${win.id}/react`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }

  async function handleSubmitDua() {
    if (!duaText.trim()) { setDuaError('Please write your du\'a.'); return; }
    setDuaSubmitting(true); setDuaError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const url = editingDua ? `${API_URL}/community/duas/${editingDua.id}` : `${API_URL}/community/duas`;
      const method = editingDua ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: duaTitle.trim() || null, text: duaText.trim(), is_anonymous: duaAnon, display_name: duaAnon ? null : (profileName || null) }),
      });
      if (!res.ok) { const e = await res.json(); setDuaError(e.error ?? 'Could not submit.'); return; }
      const result = await res.json();
      if (editingDua) {
        setDuas(prev => prev.map(d => d.id === result.id ? { ...d, ...result } : d));
        setMyPosts(prev => prev.map(p => p.id === result.id ? { ...p, ...result } : p));
        setShowDuaSubmit(false); setEditingDua(null); setDuaTitle(''); setDuaText('');
      } else {
        setDuaSuccess(result.pending ? 'pending' : true);
        setDuaText(''); setDuaAnon(false);
        fetchDuas(); fetchMyPosts();
      }
    } catch { setDuaError('Something went wrong. Please try again.'); }
    finally { setDuaSubmitting(false); }
  }

  async function handleSubmitWin() {
    if (!winText.trim()) { setWinError('Please share your win.'); return; }
    setWinSubmitting(true); setWinError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const url = editingWin ? `${API_URL}/community/wins/${editingWin.id}` : `${API_URL}/community/wins`;
      const method = editingWin ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: winTitle.trim() || null, text: winText.trim(), is_anonymous: winAnon, display_name: winAnon ? null : (profileName || null) }),
      });
      if (!res.ok) { const e = await res.json(); setWinError(e.error ?? 'Could not submit.'); return; }
      const result = await res.json();
      if (editingWin) {
        setWins(prev => prev.map(w => w.id === result.id ? { ...w, ...result } : w));
        setMyPosts(prev => prev.map(p => p.id === result.id ? { ...p, ...result } : p));
        setShowWinSubmit(false); setEditingWin(null); setWinTitle(''); setWinText('');
      } else {
        setWinSuccess(result.pending ? 'pending' : true);
        setWinText(''); setWinAnon(false);
        fetchWins(); fetchMyPosts();
      }
    } catch { setWinError('Something went wrong. Please try again.'); }
    finally { setWinSubmitting(false); }
  }

  async function handleRecommend(resource) {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) return;

    const isRec = myRecommendations.has(resource.id);
    // Optimistic update
    setMyRecommendations(prev => {
      const next = new Set(prev);
      isRec ? next.delete(resource.id) : next.add(resource.id);
      return next;
    });
    setResources(prev => prev.map(r =>
      r.id === resource.id
        ? { ...r, recommend_count: r.recommend_count + (isRec ? -1 : 1) }
        : r
    ));

    try {
      const res = await fetch(`${API_URL}/community/resources/${resource.id}/recommend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Server error');
    } catch {
      // Revert on failure
      setMyRecommendations(prev => {
        const next = new Set(prev);
        isRec ? next.add(resource.id) : next.delete(resource.id);
        return next;
      });
      setResources(prev => prev.map(r =>
        r.id === resource.id
          ? { ...r, recommend_count: r.recommend_count + (isRec ? 1 : -1) }
          : r
      ));
    }
  }

  function openEdit(resource) {
    setEditingResource(resource);
    setSubmitUrl(resource.url ?? '');
    setSubmitTitle(resource.title ?? '');
    setSubmitDesc(resource.description ?? '');
    setSubmitCategory(resource.category ?? 'Video');
    setSubmitAge(resource.age_range ?? 'All Ages');
    setSubmitWhy(resource.why_helped ?? '');
    setSubmitTags([]);
    setSubmitError('');
    setShowSubmit(true);
  }

  async function handleDeletePost(item) {
    const kindLabel = item._kind === 'dua' ? "Du'a" : item._kind === 'win' ? 'Win' : 'Resource';
    const endpoint = item._kind === 'dua'
      ? `${API_URL}/community/duas/${item.id}`
      : item._kind === 'win'
      ? `${API_URL}/community/wins/${item.id}`
      : `${API_URL}/community/resources/${item.id}`;

    Alert.alert(`Delete ${kindLabel}`, `Are you sure you want to delete this ${kindLabel.toLowerCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          try {
            await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            setMyPosts(prev => prev.filter(p => p.id !== item.id));
            if (!item._kind || item._kind === 'resource') setResources(prev => prev.filter(r => r.id !== item.id));
            if (item._kind === 'dua') setDuas(prev => prev.filter(d => d.id !== item.id));
            if (item._kind === 'win') setWins(prev => prev.filter(w => w.id !== item.id));
          } catch {
            Alert.alert('Error', 'Could not delete. Please try again.');
          }
        },
      },
    ]);
  }

  async function handleSaveResource(resource) {
    const isSaved = mySavedIds.has(resource.id);
    if (isSaved) {
      await unsaveResource(resource.id);
      setMySavedIds(prev => { const next = new Set(prev); next.delete(resource.id); return next; });
      setSavedResources(prev => prev.filter(r => r.id !== resource.id));
    } else {
      await saveResource(resource);
      setMySavedIds(prev => new Set([...prev, resource.id]));
      setSavedResources(prev => [...prev, { ...resource, kind: 'resource' }]);
    }
  }

  async function handleSubmit() {
    if (!submitUrl.trim() || !submitTitle.trim()) {
      setSubmitError('Please add a URL and title.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      if (editingResource) {
        const res = await fetch(`${API_URL}/community/resources/${editingResource.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: submitTitle.trim(),
            description: submitDesc.trim() || undefined,
            category: submitCategory,
            age_range: submitAge,
            why_helped: submitWhy.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setSubmitError(err.error ?? 'Could not update. Please try again.');
          return;
        }
        const updated = await res.json();
        setResources(prev => prev.map(r => r.id === updated.id ? updated : r));
        setMyPosts(prev => prev.map(r => r.id === updated.id ? updated : r));
        closeSubmit();
      } else {
        const res = await fetch(`${API_URL}/community/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            url: submitUrl.trim(),
            title: submitTitle.trim(),
            description: submitDesc.trim() || undefined,
            category: submitCategory,
            age_range: submitAge,
            why_helped: submitWhy.trim() || undefined,
            exclude_thumbnail: !submitIncludeThumbnail || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          const message = err.error ?? 'Could not submit. Please try again.';
          const hint = err.hint ? `\n\n${err.hint}` : '';
          setSubmitError(message + hint);
          return;
        }
        const result = await res.json();
        setSubmitSuccess(result._pending ? 'pending' : true);
        resetSubmitForm();
        fetchMyPosts();
        if (activeTab === 'resources') fetchResources();
      }
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetSubmitForm() {
    setSubmitUrl('');
    setSubmitTitle('');
    setSubmitDesc('');
    setSubmitCategory('Video');
    setSubmitAge('All Ages');
    setSubmitWhy('');
    setSubmitTags([]);
    setSubmitError('');
    setSubmitThumbnail('');
    setSubmitIncludeThumbnail(true);
  }

  function closeSubmit() {
    setShowSubmit(false);
    setSubmitSuccess(false);
    setEditingResource(null);
    resetSubmitForm();
  }

  // ── Library tab helpers ──
  const allTopics = ['All', ...Array.from(new Set(insights.flatMap(i => i.tags ?? []))).sort()];
  const filtered = insights.filter(i => {
    const matchTopic = activeTopic === 'All' || (i.tags ?? []).includes(activeTopic);
    const q = query.toLowerCase();
    return matchTopic && (!q || i.insightTitle?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q));
  });

  const totalLibraryCount = insights.length + savedResources.length;
  const subtitleText =
    activeTab === 'library'  ? (totalLibraryCount === 0 ? 'Nothing saved yet' : `${totalLibraryCount} saved item${totalLibraryCount !== 1 ? 's' : ''}`) :
    activeTab === 'myposts'  ? (myPosts.length === 0 ? 'No posts yet' : `${myPosts.length} post${myPosts.length !== 1 ? 's' : ''}`) :
    activeTab === 'dua'      ? 'Du\'a Board' :
    activeTab === 'wins'     ? 'Parenting Wins' :
    'Parents helping parents';

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={styles.bgTop} />
      <StatusBar style="light" />

      {/* ── Header tab switcher ── */}
      <View style={[styles.tabHeader, { paddingTop: insets.top + 16 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {[
            { key: 'resources', label: 'Resources',  dot: false },
            { key: 'requests',  label: 'Requests',   dot: showRequestsDot && communityNotif },
            { key: 'local',     label: 'Local',      dot: false },
            { key: 'dua',       label: "Du'a Board", dot: showDuaDot },
            { key: 'wins',      label: 'Wins',        dot: showWinsDot },
            { key: 'myposts',   label: 'My Posts',   dot: false },
          ].map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabBtn}
                onPress={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'dua') {
                    setShowDuaDot(false);
                    AsyncStorage.setItem('tarbiyah_last_visited_dua', new Date().toISOString());
                  } else if (tab.key === 'wins') {
                    setShowWinsDot(false);
                    AsyncStorage.setItem('tarbiyah_last_visited_wins', new Date().toISOString());
                  } else if (tab.key === 'requests') {
                    setShowRequestsDot(false);
                    AsyncStorage.setItem('tarbiyah_last_visited_requests', new Date().toISOString());
                  }
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabBtnLabel, active && styles.tabBtnLabelActive]}>
                  {tab.label}
                </Text>
                {active && <View style={styles.tabBtnUnderline} />}
                {tab.dot && <View style={styles.tabNewDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {activeTab === 'local' ? (
          <View style={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 2, paddingBottom: 4 }}>
            <Text style={styles.tabSubtitleMain}>Connect your family to the community</Text>
            <Text style={styles.tabSubtitleSub}>Browse your community's pages for events, classes, and activities</Text>
          </View>
        ) : (
          <Text style={styles.tabSubtitle}>
            {activeTab === 'resources' ? 'Curated resources shared by Muslim parents' :
             activeTab === 'requests'  ? 'Ask the community for a resource' :
             activeTab === 'dua'       ? "Make du'a for families in your community" :
             activeTab === 'wins'      ? 'Celebrate the small victories of parenting' :
             activeTab === 'myposts'   ? "Resources and posts you've shared" :
             ''}
          </Text>
        )}
      </View>

      <View style={styles.sheet}>
        {activeTab === 'library' ? (
          // ─── MY LIBRARY ───────────────────────────────────────────────────
          <>
            <View style={styles.controls}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={17} color="#9CA3AF" />
                <View style={{ flex: 1 }}>
                  {!query && <Text style={styles.searchPlaceholder} pointerEvents="none">Search saved insights...</Text>}
                  <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} />
                </View>
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
              {allTopics.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {allTopics.map(topic => (
                    <TouchableOpacity
                      key={topic}
                      style={[styles.filterChip, activeTopic === topic && styles.filterChipActive]}
                      onPress={() => setActiveTopic(topic)}
                    >
                      <Text style={[styles.filterChipText, activeTopic === topic && styles.filterChipTextActive]}>{topic}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {totalLibraryCount === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="bookmark-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                <Text style={styles.emptyBody}>Bookmark insights or save community resources to find them here.</Text>
              </View>
            ) : (
              <FlatList
                data={[
                  ...filtered.map(i => ({ ...i, _listKind: 'insight' })),
                  ...savedResources.map(r => ({ ...r, _listKind: 'resource' })),
                ]}
                keyExtractor={item => item._listKind + item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: 32 }]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No matches found</Text>
                    <Text style={styles.emptyBody}>Try a different search or filter.</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  if (item._listKind === 'resource') {
                    const cfg = catConfig(item.category);
                    return (
                      <View style={[styles.resourceCard, item.thumbnail_url && !hiddenThumbs.has(item.id) ? styles.resourceCardColumn : null]}>
                        {item.thumbnail_url && !hiddenThumbs.has(item.id) ? (
                          <ResourceThumb uri={item.thumbnail_url} accentColor={cfg.color} cardStyle={styles.resourceThumb} accentStyle={styles.resourceThumbAccent} onHide={() => setHiddenThumbs(prev => new Set(prev).add(item.id))} />
                        ) : (
                          <View style={[styles.resourceAccent, { backgroundColor: cfg.color }]} />
                        )}
                        <View style={styles.resourceBody}>
                        <View style={styles.resourceCardTop}>
                          <View style={[styles.resourceCatPill, { backgroundColor: cfg.color + '18' }]}>
                            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                            <Text style={[styles.resourceCatText, { color: cfg.color }]}>{item.category}</Text>
                          </View>
                          <Text style={styles.resourceAge}>{item.age_range}</Text>
                          <Text style={styles.resourceTime}>{timeAgo(item.created_at)}</Text>
                        </View>
                        <Text style={styles.resourceTitle}>{item.title}</Text>
                        {item.submitter_name ? (
                          <Text style={styles.resourcePostedBy}>Shared by {item.submitter_name}</Text>
                        ) : null}
                        {item.why_helped ? (
                          <Text style={styles.resourceWhy}>"{item.why_helped}"</Text>
                        ) : null}
                        <View style={styles.resourceActions}>
                          <TouchableOpacity
                            style={[styles.saveBtn, styles.saveBtnActive]}
                            onPress={async () => {
                              await unsaveResource(item.id);
                              setMySavedIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                              setSavedResources(prev => prev.filter(r => r.id !== item.id));
                            }}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="bookmark" size={15} color="#FFFFFF" />
                            <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>Saved</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.openBtn}
                            onPress={() => { if (item.url) Linking.openURL(item.url); }}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                            <Text style={styles.openBtnText}>Open</Text>
                          </TouchableOpacity>
                        </View>
                        </View>
                      </View>
                    );
                  }
                  const isSpiritual = item.type === 'spiritual';
                  const accentColor = isSpiritual ? '#2E7D62' : '#D4871A';
                  return (
                    <TouchableOpacity
                      style={styles.card}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('InsightDetail', { insight: item })}
                    >
                      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
                      <View style={styles.cardBody}>
                        <View style={styles.cardTopRow}>
                          <Text style={[styles.cardType, { color: accentColor }]}>
                            {isSpiritual ? 'Spiritual Insight' : 'Research Insight'}
                          </Text>
                          <TouchableOpacity onPress={async () => {
                            await unsaveInsight(item.id);
                            setInsights(prev => prev.filter(i => i.id !== item.id));
                          }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="bookmark" size={18} color={accentColor} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.cardTitle}>{item.insightTitle}</Text>
                        <Text style={styles.cardPreview} numberOfLines={2}>{item.body}</Text>
                        {item.tags?.length > 0 && (
                          <View style={styles.tagsRow}>
                            {item.tags.slice(0, 3).map(tag => (
                              <View key={tag} style={[styles.tag, { backgroundColor: accentColor + '15' }]}>
                                <Text style={[styles.tagText, { color: accentColor }]}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        ) : activeTab === 'local' ? (
          // ─── LOCAL COMMUNITY ──────────────────────────────────────────────
          <LocalCommunityTab
            communities={communities}
            loading={localLoading}
            activeCircle={activeCirle}
            onCircleChange={setActiveCircle}
            onRefresh={loadLocalData}
            mosqueSocial={mosqueSocial}
            onGoToProfile={() => navigation.navigate('Profile')}
            onSaveSocial={async (placeId, fb, ig) => {
              await saveMosqueSocialLinks(placeId, fb, ig);
              setMosqueSocial(prev => ({ ...prev, [placeId]: { facebook: fb, instagram: ig } }));
            }}
            onRetrySearch={async (placeId) => {
              setMosqueSocial(prev => ({ ...prev, [placeId]: null }));
              const links = await fetchMosqueSocialLinks(placeId, { force: true });
              setMosqueSocial(prev => ({ ...prev, [placeId]: links }));
            }}
          />
        ) : activeTab === 'requests' ? (
          // ─── RESOURCE REQUESTS ────────────────────────────────────────────
          <>
            {requestsLoading ? (
              <View style={styles.empty}><ActivityIndicator size="large" color="#1B3D2F" /></View>
            ) : requests.length === 0 ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🙋</Text>
                <Text style={styles.emptyTitle}>No requests yet</Text>
                <Text style={styles.emptyBody}>Be the first to ask the community for a helpful resource.</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingTop: 16, paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={requestsRefreshing} onRefresh={() => fetchRequests(true)} tintColor="#1B3D2F" />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={reqStyles.card}
                    activeOpacity={0.8}
                    onPress={() => openRequestDetail(item)}
                  >
                    <View style={reqStyles.cardAccent} />
                    <View style={reqStyles.cardBody}>
                      <View style={reqStyles.cardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={reqStyles.cardAuthor}>{item.is_anonymous ? 'Anonymous Parent' : (item.display_name ?? 'Parent')}</Text>
                          <Text style={reqStyles.cardTime}>{timeAgo(item.created_at)}</Text>
                        </View>
                        {(item.reply_count ?? 0) > 0 && (
                          <View style={reqStyles.replyBadge}>
                            <Ionicons name="chatbubble-outline" size={12} color="#2E7D62" />
                            <Text style={reqStyles.replyBadgeText}>{item.reply_count}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={reqStyles.cardTitle}>{item.title}</Text>
                      <Text style={reqStyles.cardDesc} numberOfLines={2}>{item.description}</Text>
                      <Text style={reqStyles.tapHint}>Tap to see replies →</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={() => setShowPostRequest(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Ask for a Resource</Text>
            </TouchableOpacity>
          </>
        ) : activeTab === 'dua' ? (
          // ─── DU'A BOARD ───────────────────────────────────────────────────
          <>
            {duasLoading ? (
              <View style={styles.empty}><ActivityIndicator size="large" color="#1B3D2F" /></View>
            ) : duas.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="sparkles" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Be the first to share a du'a</Text>
                <Text style={styles.emptyBody}>Make du'a for other families and let them know they are not alone.</Text>
              </View>
            ) : (
              <FlatList
                data={duas}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingTop: 16, paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={duasRefreshing} onRefresh={() => fetchDuas(true)} tintColor="#1B3D2F" />}
                renderItem={({ item }) => {
                  const madeDua = myDuaReactions.some(r => r.dua_id === item.id && r.type === 'made_dua');
                  const feelYou = myDuaReactions.some(r => r.dua_id === item.id && r.type === 'feel_you');
                  return (
                    <View style={styles.duaCard}>
                      <View style={styles.duaCardAccent} />
                      <View style={styles.duaBody}>
                        <View style={styles.duaTop}>
                          <View style={styles.duaAuthorRow}>
                            <View style={styles.duaAvatar}><Ionicons name="sparkles" size={18} color="#1B3D2F" /></View>
                            <View>
                              <Text style={styles.duaAuthor}>{item.is_anonymous ? 'Anonymous Parent' : (item.display_name ?? 'Parent')}</Text>
                              <Text style={styles.duaTime}>{timeAgo(item.created_at)}</Text>
                            </View>
                          </View>
                        </View>
                        {item.title ? <Text style={styles.winTitle}>{item.title}</Text> : null}
                        <Text style={styles.duaText}>{item.text}</Text>
                        <View style={styles.duaActions}>
                          <TouchableOpacity
                            style={[styles.duaReactBtn, madeDua && styles.duaReactBtnActive]}
                            onPress={() => handleDuaReact(item, 'made_dua')}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="sparkles" size={15} color={madeDua ? '#FFFFFF' : '#1B3D2F'} />
                            <Text style={[styles.duaReactText, madeDua && styles.duaReactTextActive]}>
                              {item.made_dua_count > 0 ? `${item.made_dua_count} Made Du'a` : "Made Du'a"}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.duaReactBtn, feelYou && styles.duaFeelYouActive]}
                            onPress={() => handleDuaReact(item, 'feel_you')}
                            activeOpacity={0.75}
                          >
                            <Ionicons name="heart-circle-outline" size={15} color={feelYou ? '#FFFFFF' : '#16A34A'} />
                            <Text style={[styles.duaReactText, feelYou && styles.duaReactTextActive]}>
                              {item.feel_you_count > 0 ? `${item.feel_you_count} I Feel You` : 'I Feel You'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}
            <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={() => setShowDuaSubmit(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Share a Du'a</Text>
            </TouchableOpacity>
          </>
        ) : activeTab === 'wins' ? (
          // ─── PARENTING WINS ───────────────────────────────────────────────
          <>
            {winsLoading ? (
              <View style={styles.empty}><ActivityIndicator size="large" color="#1B3D2F" /></View>
            ) : wins.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="trophy-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Share your first win</Text>
                <Text style={styles.emptyBody}>Celebrate the small and big moments of Islamic parenting with the community.</Text>
              </View>
            ) : (
              <FlatList
                data={wins}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingTop: 16, paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={winsRefreshing} onRefresh={() => fetchWins(true)} tintColor="#1B3D2F" />}
                renderItem={({ item }) => {
                  const hearted = myWinReactions.has(item.id);
                  return (
                    <View style={styles.winCard}>
                      <View style={styles.winCardAccent} />
                      <View style={styles.duaBody}>
                        <View style={styles.duaTop}>
                          <View style={styles.duaAuthorRow}>
                            <View style={[styles.duaAvatar, { backgroundColor: '#FEF9EE' }]}><Ionicons name="trophy-outline" size={18} color="#D4871A" /></View>
                            <View>
                              <Text style={styles.duaAuthor}>{item.is_anonymous ? 'Anonymous Parent' : (item.display_name ?? 'Parent')}</Text>
                              <Text style={styles.duaTime}>{timeAgo(item.created_at)}</Text>
                            </View>
                          </View>
                        </View>
                        {item.title ? <Text style={styles.winTitle}>{item.title}</Text> : null}
                        <Text style={styles.duaText}>{item.text}</Text>
                        <View style={styles.duaActions}>
                          <TouchableOpacity
                            style={[styles.duaReactBtn, hearted && styles.winHeartActive]}
                            onPress={() => handleWinReact(item)}
                            activeOpacity={0.75}
                          >
                            <Ionicons name={hearted ? 'heart' : 'heart-outline'} size={15} color={hearted ? '#FFFFFF' : '#1B3D2F'} />
                            <Text style={[styles.duaReactText, hearted && styles.duaReactTextActive]}>
                              {item.heart_count > 0 ? `${item.heart_count}` : ''}{item.heart_count > 0 ? ' ' : ''}Masha'Allah
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}
            <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={() => setShowWinSubmit(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Share a Win</Text>
            </TouchableOpacity>
          </>
        ) : activeTab === 'myposts' ? (
          // ─── MY POSTS ─────────────────────────────────────────────────────
          <>
            {myPostsLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color="#1B3D2F" />
              </View>
            ) : myPosts.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-upload-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptyBody}>Your shared resources, du'as, and wins will appear here.</Text>
              </View>
            ) : (
              <FlatList
                data={myPosts}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingTop: 16, paddingBottom: 32 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={myPostsRefreshing}
                    onRefresh={() => fetchMyPosts(true)}
                    tintColor="#1B3D2F"
                  />
                }
                renderItem={({ item }) => {
                  if (item._kind === 'dua' || item._kind === 'win') {
                    const isDua = item._kind === 'dua';
                    return (
                      <View style={isDua ? styles.duaCard : styles.winCard}>
                        <View style={isDua ? styles.duaCardAccent : styles.winCardAccent} />
                        <View style={[styles.duaBody, { paddingVertical: 12 }]}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Ionicons name={isDua ? 'sparkles' : 'trophy-outline'} size={16} color={isDua ? '#1B3D2F' : '#D4871A'} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isDua ? '#1B3D2F' : '#D4871A', textTransform: 'uppercase', letterSpacing: 0.5 }}>{isDua ? "Du'a" : 'Win'}</Text>
                            <Text style={styles.duaTime}>{timeAgo(item.created_at)}</Text>
                          </View>
                          {item.title ? <Text style={styles.winTitle}>{item.title}</Text> : null}
                          <Text style={styles.duaText}>{item.text}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            {!item.is_approved
                              ? <View style={[styles.statusPill, { alignSelf: 'flex-start' }]}><Ionicons name="time-outline" size={11} color="#D97706" /><Text style={[styles.statusPillText, { color: '#D97706' }]}>Under Review</Text></View>
                              : <View />
                            }
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                              <TouchableOpacity onPress={() => {
                                if (isDua) { setEditingDua(item); setDuaTitle(item.title ?? ''); setDuaText(item.text); setDuaAnon(item.is_anonymous); setShowDuaSubmit(true); }
                                else { setEditingWin(item); setWinTitle(item.title ?? ''); setWinText(item.text); setWinAnon(item.is_anonymous); setShowWinSubmit(true); }
                              }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={styles.ownerActionText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeletePost(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="trash-outline" size={16} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  }
                  const cfg = catConfig(item.category);
                  const isPending = item.pending_review && !item.approved && !item.rejected;
                  const isRejected = item.rejected;
                  return (
                  <View style={styles.resourceCard}>
                    <View style={[styles.resourceAccent, { backgroundColor: isRejected ? '#DC2626' : isPending ? '#D97706' : cfg.color }]} />
                    <View style={styles.resourceBody}>
                    <View style={styles.resourceCardTop}>
                      <View style={[styles.resourceCatPill, { backgroundColor: cfg.color + '18' }]}>
                        <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                        <Text style={[styles.resourceCatText, { color: cfg.color }]}>{item.category}</Text>
                      </View>
                      {isPending && (
                        <View style={styles.statusPill}>
                          <Ionicons name="time-outline" size={11} color="#D97706" />
                          <Text style={[styles.statusPillText, { color: '#D97706' }]}>Under Review</Text>
                        </View>
                      )}
                      {isRejected && (
                        <View style={[styles.statusPill, { backgroundColor: '#FEE2E2' }]}>
                          <Ionicons name="close-circle-outline" size={11} color="#DC2626" />
                          <Text style={[styles.statusPillText, { color: '#DC2626' }]}>Not Approved</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                        {!isRejected && (
                          <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.ownerActionText}>Edit</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {isRejected && item.rejection_reason ? (
                      <Text style={styles.rejectionNote}>{item.rejection_reason}</Text>
                    ) : null}
                    <Text style={styles.resourceTitle}>{item.title}</Text>
                    <Text style={styles.resourceTime}>{timeAgo(item.created_at)}</Text>
                    {item.why_helped ? (
                      <Text style={styles.resourceWhy}>"{item.why_helped}"</Text>
                    ) : null}
                    <View style={styles.resourceActions}>
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => { if (item.url) Linking.openURL(item.url); }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                        <Text style={styles.openBtnText}>Open</Text>
                      </TouchableOpacity>
                      <View style={styles.recommendCount}>
                        <Ionicons name="heart" size={13} color="#9CA3AF" />
                        <Text style={styles.recommendCountText}>{item.recommend_count ?? 0}</Text>
                      </View>
                    </View>
                    </View>
                  </View>
                  );
                }}
              />
            )}
          </>
        ) : (
          // ─── RESOURCES ────────────────────────────────────────────────────
          <>
            <View style={styles.controls}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
                    onPress={() => setActiveCategory(cat)}
                  >
                    <Text style={[styles.filterChipText, activeCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {AGE_RANGES.map(age => (
                  <TouchableOpacity
                    key={age}
                    style={[styles.filterChip, activeAge === age && styles.filterChipActive]}
                    onPress={() => setActiveAge(age)}
                  >
                    <Text style={[styles.filterChipText, activeAge === age && styles.filterChipTextActive]}>{age}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {resourcesLoading ? (
              <ResourcesLoadingView />
            ) : resources.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No resources yet</Text>
                <Text style={styles.emptyBody}>Be the first to share a resource with the community.</Text>
              </View>
            ) : (
              <FlatList
                data={resources}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchResources(true)}
                    tintColor="#1B3D2F"
                  />
                }
                renderItem={({ item }) => {
                  const recommended = myRecommendations.has(item.id);
                  const saved = mySavedIds.has(item.id);
                  const isOwner = currentUserId && item.submitted_by === currentUserId;
                  const cfg = catConfig(item.category);
                  return (
                    <View style={[styles.resourceCard, item.thumbnail_url && !hiddenThumbs.has(item.id) ? styles.resourceCardColumn : null]}>
                      {item.thumbnail_url && !hiddenThumbs.has(item.id) ? (
                        <>
                          <Image
                            source={{ uri: item.thumbnail_url }}
                            style={styles.resourceThumb}
                            resizeMode="cover"
                            onError={() => setHiddenThumbs(prev => new Set(prev).add(item.id))}
                            onLoad={e => {
                              const { width, height } = e.nativeEvent.source;
                              if (width < 100 || height < 100) setHiddenThumbs(prev => new Set(prev).add(item.id));
                            }}
                          />
                          <View style={[styles.resourceThumbAccent, { backgroundColor: cfg.color }]} />
                        </>
                      ) : (
                        <View style={[styles.resourceAccent, { backgroundColor: cfg.color }]} />
                      )}
                      <View style={styles.resourceBody}>
                      <View style={styles.resourceCardTop}>
                        <View style={[styles.resourceCatPill, { backgroundColor: cfg.color + '18' }]}>
                          <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                          <Text style={[styles.resourceCatText, { color: cfg.color }]}>{item.category}</Text>
                        </View>
                        <Text style={styles.resourceAge}>{item.age_range}</Text>
                        <Text style={styles.resourceTime}>{timeAgo(item.created_at)}</Text>
                        {isOwner && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                            <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Text style={styles.ownerActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeletePost(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="trash-outline" size={16} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      <Text style={styles.resourceTitle}>{item.title}</Text>
                      {item.submitter_name ? (
                        <Text style={styles.resourcePostedBy}>Shared by {item.submitter_name}</Text>
                      ) : null}
                      {item.why_helped ? (
                        <Text style={styles.resourceWhy}>"{item.why_helped}"</Text>
                      ) : null}
                      <View style={styles.resourceActions}>
                        <TouchableOpacity
                          style={[styles.recommendBtn, recommended && styles.recommendBtnActive]}
                          onPress={() => handleRecommend(item)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={recommended ? 'heart' : 'heart-outline'} size={15} color={recommended ? '#FFFFFF' : '#1B3D2F'} />
                          <Text style={[styles.recommendBtnText, recommended && { color: '#FFFFFF' }]}>
                            {item.recommend_count > 0 ? `${item.recommend_count} recommend` : 'Recommend'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.saveBtn, saved && styles.saveBtnActive]}
                          onPress={() => handleSaveResource(item)}
                          activeOpacity={0.75}
                        >
                          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={15} color={saved ? '#FFFFFF' : '#1B3D2F'} />
                          <Text style={[styles.saveBtnText, saved && { color: '#FFFFFF' }]}>
                            {saved ? 'Saved' : 'Save'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.openBtn}
                          onPress={() => { if (item.url) Linking.openURL(item.url); }}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                          <Text style={styles.openBtnText}>Open</Text>
                        </TouchableOpacity>
                      </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Share a Resource FAB */}
            <TouchableOpacity
              style={[styles.fab, { bottom: insets.bottom + 20 }]}
              onPress={() => setShowSubmit(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
              <Text style={styles.fabText}>Share a Resource</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Submit Modal ── */}
      <Modal visible={showSubmit} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingResource ? 'Edit Resource' : 'Share a Resource'}</Text>
              <TouchableOpacity onPress={closeSubmit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {submitSuccess ? (
              <View style={styles.successState}>
                <View style={[styles.successIcon, submitSuccess === 'pending' && { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons
                    name={submitSuccess === 'pending' ? 'time-outline' : 'checkmark-circle'}
                    size={56}
                    color={submitSuccess === 'pending' ? '#D97706' : '#2E7D62'}
                  />
                </View>
                <Text style={styles.successTitle}>
                  {submitSuccess === 'pending' ? 'Under Review' : 'JazakAllah Khayran!'}
                </Text>
                <Text style={styles.successBody}>
                  {submitSuccess === 'pending'
                    ? 'Your resource has been saved and will be reviewed shortly to keep the community safe. You can track it in My Posts.'
                    : 'Your resource has been shared with the community.'}
                </Text>
                <TouchableOpacity style={styles.successBtn} onPress={closeSubmit}>
                  <Text style={styles.successBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Resource Link *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://..."
                  value={submitUrl}
                  onChangeText={setSubmitUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Title *</Text>
                  {fetchingMeta && <ActivityIndicator size="small" color="#1B3D2F" />}
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="What is this resource called?"
                  value={submitTitle}
                  onChangeText={setSubmitTitle}
                />

                {submitThumbnail ? (
                  <View style={styles.thumbPreviewWrap}>
                    <Text style={styles.fieldLabel}>Image Preview</Text>
                    <View style={styles.thumbPreviewCard}>
                      {submitIncludeThumbnail ? (
                        <Image
                          source={{ uri: submitThumbnail }}
                          style={styles.thumbPreviewImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.thumbPreviewRemoved}>
                          <Ionicons name="image-outline" size={28} color="#D1D5DB" />
                          <Text style={styles.thumbPreviewRemovedText}>No image</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.thumbToggleBtn}
                        onPress={() => setSubmitIncludeThumbnail(prev => !prev)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={submitIncludeThumbnail ? 'close-circle-outline' : 'image-outline'}
                          size={14}
                          color={submitIncludeThumbnail ? '#6B7280' : '#1B3D2F'}
                        />
                        <Text style={[styles.thumbToggleText, !submitIncludeThumbnail && { color: '#1B3D2F' }]}>
                          {submitIncludeThumbnail ? 'Remove image' : 'Include image'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ marginBottom: 16 }}>
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChip, submitCategory === cat && styles.filterChipActive]}
                      onPress={() => setSubmitCategory(cat)}
                    >
                      <Text style={[styles.filterChipText, submitCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Best for age</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ marginBottom: 16 }}>
                  {AGE_RANGES.map(age => (
                    <TouchableOpacity
                      key={age}
                      style={[styles.filterChip, submitAge === age && styles.filterChipActive]}
                      onPress={() => setSubmitAge(age)}
                    >
                      <Text style={[styles.filterChipText, submitAge === age && styles.filterChipTextActive]}>{age}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Why did this help your family? <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Share a brief reflection..."
                  value={submitWhy}
                  onChangeText={setSubmitWhy}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.fieldLabel}>Quick tags <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
                <View style={styles.tagsRow}>
                  {REFLECTION_TAGS.map(tag => {
                    const selected = submitTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.reflectionTag, selected && styles.reflectionTagActive]}
                        onPress={() => setSubmitTags(prev =>
                          selected ? prev.filter(t => t !== tag) : [...prev, tag]
                        )}
                      >
                        {selected && <Ionicons name="checkmark" size={11} color="#2E7D62" style={{ marginRight: 3 }} />}
                        <Text style={[styles.reflectionTagText, selected && styles.reflectionTagTextActive]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.submitBtnText}>
                          {editingResource ? 'Saving...' : 'Reviewing…'}
                        </Text>
                      </View>
                    : <Text style={styles.submitBtnText}>{editingResource ? 'Save Changes' : 'Submit Resource'}</Text>
                  }
                </TouchableOpacity>
                {!editingResource && (
                  <Text style={styles.submitNote}>
                    {submitting
                      ? 'Your submission is being reviewed to keep the community safe. This takes a few seconds.'
                      : 'All submissions are reviewed before going live to keep the community safe.'}
                  </Text>
                )}
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Community Splash ── */}
      <Modal visible={showCommSplash} animationType="fade" transparent>
        <View style={reqStyles.splashOverlay}>
          <View style={reqStyles.splashSheet}>
            <View style={reqStyles.splashIconRow}>
              <Text style={{ fontSize: 36 }}>🤝</Text>
            </View>
            <Text style={reqStyles.splashTitle}>Welcome to the Community</Text>
            <Text style={reqStyles.splashHadith}>
              "The believers in their mutual kindness, compassion, and sympathy are just like one body."
            </Text>
            <Text style={reqStyles.splashHadithSrc}>— Prophet Muhammad ﷺ (Bukhari & Muslim)</Text>
            <Text style={reqStyles.splashBody}>
              When you share a resource or answer a parent's request, you may be the reason a child is raised with stronger iman. Every link shared is sadaqah.
            </Text>
            <View style={reqStyles.splashToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={reqStyles.splashToggleLabel}>Community notifications</Text>
                <Text style={reqStyles.splashToggleSub}>Show a dot when new requests or posts arrive</Text>
              </View>
              <Switch
                value={communityNotif}
                onValueChange={val => {
                  setCommunityNotif(val);
                  AsyncStorage.setItem('tarbiyah_community_notifications', String(val));
                }}
                trackColor={{ false: '#E8EAED', true: '#34C759' }}
                thumbColor={communityNotif ? '#1B3D2F' : '#FFF'}
                ios_backgroundColor="#E8EAED"
              />
            </View>
            <TouchableOpacity
              style={reqStyles.splashBtn}
              onPress={() => {
                AsyncStorage.setItem('tarbiyah_community_welcome_v1', '1');
                setShowCommSplash(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={reqStyles.splashBtnText}>Let's go</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Post Request Modal ── */}
      <Modal visible={showPostRequest} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask for a Resource</Text>
              <TouchableOpacity onPress={() => { setShowPostRequest(false); setReqTitle(''); setReqDesc(''); setReqError(''); setReqSuccess(false); setReqAnon(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            {reqSuccess ? (
              <View style={styles.successState}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color="#2E7D62" />
                </View>
                <Text style={styles.successTitle}>Request posted!</Text>
                <Text style={styles.successBody}>Your question is live. The community will be able to suggest resources that might help.</Text>
                <TouchableOpacity style={styles.successBtn} onPress={() => { setShowPostRequest(false); setReqTitle(''); setReqDesc(''); setReqSuccess(false); setReqAnon(false); }}>
                  <Text style={styles.successBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>What do you need? *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Videos on how to explain prayer to a 5-year-old"
                  value={reqTitle}
                  onChangeText={setReqTitle}
                  maxLength={120}
                />
                <Text style={styles.fieldLabel}>Tell us more *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Share any extra context — age of your child, what you've already tried, etc."
                  value={reqDesc}
                  onChangeText={setReqDesc}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <TouchableOpacity style={styles.anonRow} onPress={() => setReqAnon(p => !p)} activeOpacity={0.75}>
                  <View style={[styles.anonCheck, reqAnon && styles.anonCheckActive]}>
                    {reqAnon && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.anonLabel}>Post anonymously</Text>
                </TouchableOpacity>
                {reqError ? <Text style={styles.submitError}>{reqError}</Text> : null}
                <TouchableOpacity
                  style={[styles.submitBtn, reqSubmitting && { opacity: 0.7 }]}
                  onPress={handlePostRequest}
                  disabled={reqSubmitting}
                  activeOpacity={0.85}
                >
                  {reqSubmitting
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.submitBtnText}>Reviewing…</Text>
                      </View>
                    : <Text style={styles.submitBtnText}>Post Request</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.submitNote}>Requests are reviewed to keep the community safe and on-topic.</Text>
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Request Detail Modal ── */}
      <Modal visible={!!requestDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { flex: 1 }]} numberOfLines={1}>{requestDetail?.title ?? ''}</Text>
            <TouchableOpacity onPress={() => { setRequestDetail(null); setRequestReplies([]); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            {/* Original request */}
            <View style={reqStyles.detailRequest}>
              <Text style={reqStyles.detailAuthor}>{requestDetail?.is_anonymous ? 'Anonymous Parent' : (requestDetail?.display_name ?? 'Parent')} · {timeAgo(requestDetail?.created_at)}</Text>
              <Text style={reqStyles.detailTitle}>{requestDetail?.title}</Text>
              <Text style={reqStyles.detailDesc}>{requestDetail?.description}</Text>
            </View>

            <Text style={reqStyles.repliesHeader}>
              {requestReplies.length > 0 ? `${requestReplies.length} suggestion${requestReplies.length !== 1 ? 's' : ''}` : 'No suggestions yet'}
            </Text>

            {repliesLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1B3D2F" />
              </View>
            ) : requestReplies.length === 0 ? (
              <View style={reqStyles.repliesEmpty}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📚</Text>
                <Text style={reqStyles.repliesEmptyText}>Be the first to suggest a resource</Text>
              </View>
            ) : (
              requestReplies.map(reply => {
                const myReaction = myReplyReactions[reply.id];
                return (
                  <View key={reply.id} style={reqStyles.replyCard}>
                    <View style={reqStyles.replyCardTop}>
                      <Text style={reqStyles.replyAuthor}>{reply.display_name ?? 'Parent'}</Text>
                      <Text style={reqStyles.replyTime}>{timeAgo(reply.created_at)}</Text>
                    </View>
                    {reply.category ? (
                      <View style={reqStyles.replyCatChip}>
                        <Text style={reqStyles.replyCatText}>{reply.category}</Text>
                      </View>
                    ) : null}
                    {reply.title ? <Text style={reqStyles.replyTitle}>{reply.title}</Text> : null}
                    <Text style={reqStyles.replyUrl} numberOfLines={1}>{reply.url}</Text>
                    {reply.comment ? <Text style={reqStyles.replyComment}>{reply.comment}</Text> : null}
                    <View style={reqStyles.replyActions}>
                      <TouchableOpacity
                        style={[reqStyles.replyActionBtn, myReaction === 'agree' && reqStyles.replyActionBtnAgree]}
                        onPress={() => handleReplyReact(reply, 'agree')}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="thumbs-up-outline" size={14} color={myReaction === 'agree' ? '#FFFFFF' : '#2E7D62'} />
                        <Text style={[reqStyles.replyActionText, myReaction === 'agree' && { color: '#FFFFFF' }]}>
                          {reply.agree_count > 0 ? `${reply.agree_count} Agree` : 'Agree'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[reqStyles.replyActionBtn, myReaction === 'warn' && reqStyles.replyActionBtnWarn]}
                        onPress={() => {
                          if (myReaction === 'warn') { handleReplyReact(reply, 'warn'); return; }
                          setWarnTarget(reply); setWarnText('');
                        }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="warning-outline" size={14} color={myReaction === 'warn' ? '#FFFFFF' : '#D97706'} />
                        <Text style={[reqStyles.replyActionText, { color: myReaction === 'warn' ? '#FFFFFF' : '#D97706' }]}>
                          {reply.warn_count > 0 ? `${reply.warn_count} Warn` : 'Warn'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={reqStyles.replyActionBtn}
                        onPress={() => { saveResource({ id: reply.id, url: reply.url, title: reply.title ?? reply.url, category: reply.category ?? 'Other', _kind: 'resource' }); }}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="bookmark-outline" size={14} color="#6B7280" />
                        <Text style={[reqStyles.replyActionText, { color: '#6B7280' }]}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={reqStyles.replyActionBtn}
                        onPress={() => Linking.openURL(reply.url)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="open-outline" size={14} color="#6B7280" />
                        <Text style={[reqStyles.replyActionText, { color: '#6B7280' }]}>Open</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={reqStyles.detailFabWrap}>
            <TouchableOpacity
              style={reqStyles.detailFab}
              onPress={() => setShowReplyForm(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="link-outline" size={18} color="#FFFFFF" />
              <Text style={reqStyles.detailFabText}>Share a Resource</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Reply Form Modal ── */}
      <Modal visible={showReplyForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share a Resource</Text>
              <TouchableOpacity onPress={() => { setShowReplyForm(false); setReplyUrl(''); setReplyTitle(''); setReplyCategory('Video'); setReplyComment(''); setReplyError(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>Resource Link *</Text>
                {replyFetchingMeta && <ActivityIndicator size="small" color="#1B3D2F" />}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="https://..."
                value={replyUrl}
                onChangeText={setReplyUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Auto-filled from the link"
                value={replyTitle}
                onChangeText={setReplyTitle}
              />
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={{ marginBottom: 16 }}>
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.filterChip, replyCategory === cat && styles.filterChipActive]}
                    onPress={() => setReplyCategory(cat)}
                  >
                    <Text style={[styles.filterChipText, replyCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.fieldLabel}>Why does this help? <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Share a brief note for the person who asked..."
                value={replyComment}
                onChangeText={setReplyComment}
                multiline
                numberOfLines={3}
                maxLength={280}
              />
              {replyError ? <Text style={styles.submitError}>{replyError}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, replySubmitting && { opacity: 0.7 }]}
                onPress={handleSubmitReply}
                disabled={replySubmitting}
                activeOpacity={0.85}
              >
                {replySubmitting
                  ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.submitBtnText}>Sharing…</Text>
                    </View>
                  : <Text style={styles.submitBtnText}>Share Resource</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Warn Modal ── */}
      <Modal visible={!!warnTarget} animationType="fade" transparent>
        <View style={reqStyles.splashOverlay}>
          <View style={reqStyles.warnSheet}>
            <Text style={reqStyles.warnTitle}>Add a warning</Text>
            <Text style={reqStyles.warnSub}>What's your concern? Keep it brief.</Text>
            <TextInput
              style={[styles.textInput, { marginTop: 12, marginBottom: 4 }]}
              placeholder="e.g. Contains music, not age-appropriate..."
              value={warnText}
              onChangeText={setWarnText}
              maxLength={120}
            />
            <View style={reqStyles.warnActions}>
              <TouchableOpacity style={reqStyles.warnCancel} onPress={() => setWarnTarget(null)} activeOpacity={0.75}>
                <Text style={reqStyles.warnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={reqStyles.warnConfirm}
                onPress={() => { handleReplyReact(warnTarget, 'warn', warnText); setWarnTarget(null); setWarnText(''); }}
                activeOpacity={0.85}
              >
                <Text style={reqStyles.warnConfirmText}>Submit Warning</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Du'a Submit Modal ── */}
      <Modal visible={showDuaSubmit} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingDua ? "Edit Du'a" : "Share a Du'a"}</Text>
              <TouchableOpacity onPress={() => { setShowDuaSubmit(false); setDuaSuccess(false); setDuaTitle(''); setDuaText(''); setDuaError(''); setEditingDua(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            {duaSuccess ? (
              <View style={styles.successState}>
                <View style={[styles.successIcon, duaSuccess === 'pending' && { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name={duaSuccess === 'pending' ? 'time-outline' : 'sparkles'} size={48} color={duaSuccess === 'pending' ? '#D97706' : '#2E7D62'} />
                </View>
                <Text style={styles.successTitle}>{duaSuccess === 'pending' ? 'Almost there!' : 'JazakAllah Khayran!'}</Text>
                <Text style={styles.successBody}>
                  {duaSuccess === 'pending'
                    ? "Your du'a is being reviewed and will appear shortly. You can track it in My Posts."
                    : "Your du'a has been shared with the community. May Allah answer all our du'as."}
                </Text>
                <TouchableOpacity style={styles.successBtn} onPress={() => { setShowDuaSubmit(false); setDuaSuccess(false); }}>
                  <Text style={styles.successBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Title <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. For my children's guidance"
                  value={duaTitle}
                  onChangeText={setDuaTitle}
                  maxLength={60}
                />
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: -14, marginBottom: 16, textAlign: 'right' }}>{duaTitle.length}/60</Text>

                <Text style={styles.fieldLabel}>Your Du'a</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { minHeight: 120 }]}
                  placeholder="Share a du'a you're making for your children or family..."
                  value={duaText}
                  onChangeText={setDuaText}
                  multiline
                  maxLength={280}
                />
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: -14, marginBottom: 16, textAlign: 'right' }}>{duaText.length}/280</Text>

                <TouchableOpacity style={styles.anonRow} onPress={() => setDuaAnon(p => !p)} activeOpacity={0.75}>
                  <View style={[styles.anonCheck, duaAnon && styles.anonCheckActive]}>
                    {duaAnon && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.anonLabel}>Post anonymously</Text>
                </TouchableOpacity>

                {duaError ? <Text style={styles.submitError}>{duaError}</Text> : null}
                <TouchableOpacity style={[styles.submitBtn, duaSubmitting && { opacity: 0.7 }]} onPress={handleSubmitDua} disabled={duaSubmitting} activeOpacity={0.85}>
                  {duaSubmitting
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color="#FFFFFF" size="small" /><Text style={styles.submitBtnText}>{editingDua ? 'Saving...' : 'Sharing...'}</Text></View>
                    : <Text style={styles.submitBtnText}>{editingDua ? 'Save Changes' : "Share Du'a"}</Text>
                  }
                </TouchableOpacity>
                {!editingDua && <Text style={styles.submitNote}>All posts are reviewed before going live to keep the community safe.</Text>}
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Win Submit Modal ── */}
      <Modal visible={showWinSubmit} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingWin ? 'Edit Win' : 'Share a Win'}</Text>
              <TouchableOpacity onPress={() => { setShowWinSubmit(false); setWinSuccess(false); setWinTitle(''); setWinText(''); setWinError(''); setEditingWin(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>
            {winSuccess ? (
              <View style={styles.successState}>
                <View style={[styles.successIcon, winSuccess === 'pending' ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#FEF9EE' }]}>
                  <Ionicons name={winSuccess === 'pending' ? 'time-outline' : 'trophy-outline'} size={48} color={winSuccess === 'pending' ? '#D97706' : '#D4871A'} />
                </View>
                <Text style={styles.successTitle}>{winSuccess === 'pending' ? 'Almost there!' : "Masha'Allah!"}</Text>
                <Text style={styles.successBody}>
                  {winSuccess === 'pending'
                    ? 'Your win is being reviewed and will appear shortly. You can track it in My Posts.'
                    : 'Your win has been shared with the community. Keep going!'}
                </Text>
                <TouchableOpacity style={styles.successBtn} onPress={() => { setShowWinSubmit(false); setWinSuccess(false); }}>
                  <Text style={styles.successBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Title <Text style={styles.fieldLabelOptional}>(optional)</Text></Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. First Fajr together"
                  value={winTitle}
                  onChangeText={setWinTitle}
                  maxLength={60}
                />
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: -14, marginBottom: 16, textAlign: 'right' }}>{winTitle.length}/60</Text>

                <Text style={styles.fieldLabel}>What happened?</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { minHeight: 120 }]}
                  placeholder="Share the moment — big or small. What made you proud?"
                  value={winText}
                  onChangeText={setWinText}
                  multiline
                  maxLength={280}
                />
                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: -14, marginBottom: 16, textAlign: 'right' }}>{winText.length}/280</Text>

                <TouchableOpacity style={styles.anonRow} onPress={() => setWinAnon(p => !p)} activeOpacity={0.75}>
                  <View style={[styles.anonCheck, winAnon && styles.anonCheckActive]}>
                    {winAnon && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.anonLabel}>Post anonymously</Text>
                </TouchableOpacity>

                {winError ? <Text style={styles.submitError}>{winError}</Text> : null}
                <TouchableOpacity style={[styles.submitBtn, winSubmitting && { opacity: 0.7 }]} onPress={handleSubmitWin} disabled={winSubmitting} activeOpacity={0.85}>
                  {winSubmitting
                    ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ActivityIndicator color="#FFFFFF" size="small" /><Text style={styles.submitBtnText}>{editingWin ? 'Saving...' : 'Submitting...'}</Text></View>
                    : <Text style={styles.submitBtnText}>{editingWin ? 'Save Changes' : 'Share Win'}</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.submitNote}>All posts are reviewed before going live to keep the community safe.</Text>
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Resources loading overlay ── */}
      {overlayVisible && (
        <Animated.View
          style={[styles.loadingOverlay, { transform: [{ translateY: overlayTranslateY }] }]}
        >
          <Text style={styles.loadingOverlayTitle}>Community</Text>
          <Text style={styles.loadingOverlayHadith}>{`"${overlayHadith}"`}</Text>
          <Text style={styles.loadingOverlayAttribution}>— Prophet Muhammad ﷺ</Text>
          <Text style={styles.loadingOverlayTagline}>Parents helping parents</Text>
          <Animated.View style={{ opacity: overlayBtnOpacity, marginTop: 40 }}>
            <TouchableOpacity style={styles.overlayBtn} onPress={dismissOverlay} activeOpacity={0.85} disabled={!overlayReady}>
              <Text style={styles.overlayBtnText}>Continue</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

    </SafeAreaView>
  );
}

// ─── Trust badge config ───────────────────────────────────────────────────────
const TRUST_CONFIG = {
  tarbiyah:            { icon: '✅', label: 'Verified by Tarbiyah',       color: '#2E7D62', bg: '#EDF7F2' },
  official:            { icon: '🏢', label: 'Official Organisation Post', color: '#1D4ED8', bg: '#EFF6FF' },
  community_confirmed: { icon: '👥', label: 'Community Confirmed',        color: '#D4871A', bg: '#FDF3E3' },
  community:           { icon: '⚠️', label: 'Community Submitted',        color: '#9CA3AF', bg: '#F3F4F6' },
};

const EVENT_CATEGORIES = ['general','halaqah','youth','family','announcement','program','class'];

// ─── LocalCommunityTab ────────────────────────────────────────────────────────
function LocalCommunityTab({ communities, loading, activeCircle, onCircleChange, onRefresh, mosqueSocial, onGoToProfile, onSaveSocial, onRetrySearch }) {
  const insets = useSafeAreaInsets();
  const [webLoadFailed, setWebLoadFailed] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [manualFb, setManualFb] = useState('');
  const [manualIg, setManualIg] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const activeMosque = communities.find(c => c.placeId === activeCircle) ?? communities[0];

  // Reset webview loading state when mosque changes
  useEffect(() => { setShowManual(false); setWebLoadFailed(false); setWebLoading(true); }, [activeMosque?.placeId]);

  // Fallback: hide spinner after 8s in case onLoadEnd never fires
  useEffect(() => {
    if (!webLoading) return;
    const t = setTimeout(() => setWebLoading(false), 3000);
    return () => clearTimeout(t);
  }, [webLoading]);

  const social = activeMosque ? mosqueSocial?.[activeMosque.placeId] : undefined;
  const hasFb  = !!social?.facebook;
  const hasIg  = !!social?.instagram;
  const socialFetched = social !== undefined && social !== null;
  const noLinks = socialFetched && !hasFb && !hasIg;
  const websiteUrl = social?.website ?? null;
  const webviewUrl = social?.eventsUrl ?? websiteUrl;

  async function handleSaveManual() {
    const fb = manualFb.trim();
    const ig = manualIg.trim();
    if (!fb && !ig) { setManualError('Enter at least one URL.'); return; }
    if (fb && !fb.includes('facebook.com')) { setManualError('Facebook URL must contain facebook.com'); return; }
    if (ig && !ig.includes('instagram.com')) { setManualError('Instagram URL must contain instagram.com'); return; }
    setManualError('');
    setSavingManual(true);
    try {
      await onSaveSocial(activeMosque.placeId, fb || null, ig || null);
      setManualFb(''); setManualIg('');
      setShowManual(false);
    } catch { setManualError('Could not save. Please try again.'); }
    setSavingManual(false);
  }

  if (loading) return (
    <View style={lcStyles.center}><ActivityIndicator size="large" color="#1B3D2F" /></View>
  );

  if (!communities.length) return (
    <View style={lcStyles.emptyWrap}>
      <Text style={lcStyles.emptyEmoji}>🕌</Text>
      <Text style={lcStyles.emptyTitle}>Connect to your community</Text>
      <Text style={lcStyles.emptySub}>
        The Prophet ﷺ said: "The believer to another believer is like a building, each part strengthening the other."{'\n\n'}Your local mosque is where your family belongs. Add yours to stay connected to events, programmes, and the people raising their children alongside you.
      </Text>
      <TouchableOpacity style={lcStyles.emptyBtn} onPress={onGoToProfile} activeOpacity={0.85}>
        <Ionicons name="person-circle-outline" size={18} color="#FFFFFF" />
        <Text style={lcStyles.emptyBtnText}>Go to Profile</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* ── Mosque pills (only if multiple) ── */}
      {communities.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lcStyles.pillScroll} contentContainerStyle={lcStyles.pillRow}>
          {communities.map(c => {
            const active = (activeCircle ?? communities[0].placeId) === c.placeId;
            return (
              <TouchableOpacity
                key={c.placeId}
                style={[lcStyles.pill, active && lcStyles.pillActive]}
                onPress={() => onCircleChange(c.placeId)}
                activeOpacity={0.75}
              >
                <Text style={[lcStyles.pillText, active && lcStyles.pillTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Social banner ── */}
      <View style={lcStyles.banner}>
        {/* Left: context message */}
        <View style={lcStyles.bannerLeft}>
          <Text style={lcStyles.bannerLabel}>🔗 CONNECT</Text>
          <Text style={lcStyles.bannerMsg}>
            {noLinks
              ? "We couldn't find their Facebook or Instagram pages."
              : 'Events and activities are often posted on socials'}
          </Text>
        </View>

        {/* Right: social buttons or states */}
        <View style={lcStyles.bannerRight}>
          {social === null && (
            <ActivityIndicator size="small" color="#1B3D2F" />
          )}
          {(hasFb || hasIg) && (
            <View style={lcStyles.bannerBtns}>
              {hasFb && (
                <TouchableOpacity style={[lcStyles.socialBtn, lcStyles.fbBtn]} onPress={() => Linking.openURL(social.facebook)} activeOpacity={0.8}>
                  <Ionicons name="logo-facebook" size={15} color="#fff" />
                  <Text style={lcStyles.socialBtnText}>Facebook</Text>
                </TouchableOpacity>
              )}
              {hasIg && (
                <TouchableOpacity style={[lcStyles.socialBtn, lcStyles.igBtn]} onPress={() => Linking.openURL(social.instagram)} activeOpacity={0.8}>
                  <Ionicons name="logo-instagram" size={15} color="#fff" />
                  <Text style={lcStyles.socialBtnText}>Instagram</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {noLinks && (
            <View style={lcStyles.noLinksCol}>
              <View style={lcStyles.noLinksActions}>
                <TouchableOpacity style={lcStyles.retryBtn} onPress={() => onRetrySearch(activeMosque.placeId)} activeOpacity={0.7}>
                  <Ionicons name="refresh-outline" size={12} color="#2E7D62" />
                  <Text style={lcStyles.retryBtnText}>Search again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={lcStyles.retryBtn} onPress={() => setShowManual(true)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={12} color="#2E7D62" />
                  <Text style={lcStyles.retryBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── Manual entry sheet (slides in when no links + user taps Add pages) ── */}
      {showManual && (
        <View style={lcStyles.manualSheet}>
          <Text style={lcStyles.manualTitle}>Add social pages</Text>
          <TextInput style={lcStyles.socialInput} value={manualFb} onChangeText={setManualFb}
            placeholder="Facebook page URL" placeholderTextColor="#9CA3AF"
            autoCapitalize="none" keyboardType="url" />
          <TextInput style={lcStyles.socialInput} value={manualIg} onChangeText={setManualIg}
            placeholder="Instagram page URL" placeholderTextColor="#9CA3AF"
            autoCapitalize="none" keyboardType="url" />
          {!!manualError && <Text style={lcStyles.socialError}>{manualError}</Text>}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={[lcStyles.socialSaveBtn, { flex: 1, backgroundColor: '#E5E7EB' }]} onPress={() => setShowManual(false)} activeOpacity={0.8}>
              <Text style={[lcStyles.socialSaveBtnText, { color: '#374151' }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[lcStyles.socialSaveBtn, { flex: 1 }, savingManual && { opacity: 0.6 }]} onPress={handleSaveManual} disabled={savingManual} activeOpacity={0.85}>
              {savingManual ? <ActivityIndicator size="small" color="#fff" /> : <Text style={lcStyles.socialSaveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── WebView area ── */}
      <View style={{ flex: 1 }}>
        {/* Loading social data */}
        {social === null && (
          <View style={lcStyles.center}>
            <ActivityIndicator size="large" color="#1B3D2F" />
          </View>
        )}

        {/* No website found */}
        {socialFetched && !websiteUrl && (
          <View style={lcStyles.center}>
            <Ionicons name="globe-outline" size={36} color="#D1D5DB" />
            <Text style={lcStyles.noWebsiteText}>No website found for this mosque</Text>
          </View>
        )}

        {/* WebView — shown immediately */}
        {webviewUrl && WebView && !webLoadFailed && (() => {
          const secureUrl = webviewUrl.replace(/^http:\/\//i, 'https://');
          return (
            <View style={{ flex: 1 }}>
              <WebView
                key={secureUrl}
                source={{ uri: secureUrl }}
                style={{ flex: 1 }}
                onLoadEnd={() => setWebLoading(false)}
                onError={() => { setWebLoading(false); setWebLoadFailed(true); }}
                onHttpError={() => { setWebLoading(false); setWebLoadFailed(true); }}
              />
              {webLoading && (
                <View style={lcStyles.webSpinnerOverlay}>
                  <ActivityIndicator size="large" color="#1B3D2F" />
                  <Text style={lcStyles.webLoadingTitle}>
                    Connecting to "{activeMosque?.name}"
                  </Text>
                  <Text style={lcStyles.webLoadingSubtext}>
                    Some mosque connections take a moment to load
                  </Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* Load failure — offer to open in Safari */}
        {webviewUrl && webLoadFailed && (
          <View style={lcStyles.center}>
            <Ionicons name="globe-outline" size={36} color="#D1D5DB" />
            <Text style={lcStyles.noWebsiteText}>This site couldn't load in-app.</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(webviewUrl ?? websiteUrl)}
              activeOpacity={0.8}
              style={[lcStyles.openWebBtn, { marginTop: 16 }]}
            >
              <Ionicons name="open-outline" size={16} color="#1B3D2F" />
              <Text style={lcStyles.openWebBtnText}>Open in Safari</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView not available fallback */}
        {webviewUrl && !WebView && (
          <View style={lcStyles.center}>
            <TouchableOpacity onPress={() => Linking.openURL(webviewUrl)} activeOpacity={0.8} style={lcStyles.openWebBtn}>
              <Ionicons name="globe-outline" size={18} color="#1B3D2F" />
              <Text style={lcStyles.openWebBtnText}>Open website</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────
function EventCard({ event: ev, myVerdict, onVerify }) {
  const trust = TRUST_CONFIG[ev.trust_level] ?? TRUST_CONFIG.community;
  const isUnverified = ev.trust_level === 'community';
  const isCommunityConfirmed = ev.trust_level === 'community_confirmed';
  const dateStr = ev.event_date
    ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={ecStyles.card}>
      {/* Trust badge */}
      <View style={[ecStyles.badge, { backgroundColor: trust.bg }]}>
        <Text style={ecStyles.badgeIcon}>{trust.icon}</Text>
        <Text style={[ecStyles.badgeLabel, { color: trust.color }]}>{trust.label}</Text>
      </View>

      {/* Event info */}
      <Text style={ecStyles.title}>{ev.title}</Text>
      {ev.description ? <Text style={ecStyles.desc}>{ev.description}</Text> : null}

      <View style={ecStyles.metaRow}>
        {dateStr && (
          <View style={ecStyles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color="#6B7280" />
            <Text style={ecStyles.metaText}>{dateStr}{ev.event_time ? ` · ${ev.event_time}` : ''}</Text>
          </View>
        )}
        {ev.location && (
          <View style={ecStyles.metaItem}>
            <Ionicons name="location-outline" size={13} color="#6B7280" />
            <Text style={ecStyles.metaText}>{ev.location}</Text>
          </View>
        )}
        <View style={[ecStyles.categoryChip]}>
          <Text style={ecStyles.categoryText}>{ev.category}</Text>
        </View>
      </View>

      {/* Unverified warning */}
      {isUnverified && (
        <View style={ecStyles.warningBox}>
          <Text style={ecStyles.warningTitle}>⚠️ Not yet verified — confirm before attending</Text>
          {(ev.org_phone || ev.org_website || ev.org_address) && (
            <View style={ecStyles.contactBlock}>
              <Text style={ecStyles.contactOrg}>{ev.org_name}</Text>
              {ev.org_address && <Text style={ecStyles.contactLine}>📍 {ev.org_address}</Text>}
              {ev.org_phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${ev.org_phone}`)}>
                  <Text style={ecStyles.contactLink}>📞 {ev.org_phone}</Text>
                </TouchableOpacity>
              )}
              {ev.org_website && (
                <TouchableOpacity onPress={() => Linking.openURL(ev.org_website)}>
                  <Text style={ecStyles.contactLink}>🌐 Visit website</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Community confirmed softer note */}
      {isCommunityConfirmed && (
        <View style={ecStyles.confirmedBox}>
          <Text style={ecStyles.confirmedText}>👥 Verified by {ev.verify_count} community member{ev.verify_count !== 1 ? 's' : ''} — always confirm before attending</Text>
        </View>
      )}

      {/* Verify row */}
      {(isUnverified || isCommunityConfirmed) && (
        <TouchableOpacity
          style={[ecStyles.verifyBtn, myVerdict && ecStyles.verifyBtnDone]}
          onPress={() => onVerify(ev)}
          activeOpacity={0.8}
        >
          <Ionicons name={myVerdict ? 'checkmark-circle' : 'shield-checkmark-outline'} size={14} color={myVerdict ? '#2E7D62' : '#6B7280'} />
          <Text style={[ecStyles.verifyBtnText, myVerdict && { color: '#2E7D62' }]}>
            {myVerdict === 'confirmed' ? 'You confirmed this'
              : myVerdict === 'attended' ? 'You attended this'
              : myVerdict === 'incorrect' ? 'You flagged this as incorrect'
              : 'Help verify this event'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── SubmitEventModal ─────────────────────────────────────────────────────────
function SubmitEventModal({ visible, communities, currentUserId, onClose, onSubmitted }) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [date,        setDate]        = useState('');
  const [time,        setTime]        = useState('');
  const [location,    setLocation]    = useState('');
  const [category,    setCategory]    = useState('general');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(''); setDescription(''); setDate(''); setTime('');
      setLocation(''); setCategory('general'); setError('');
      setSelectedOrg(communities.length === 1 ? communities[0] : null);
    }
  }, [visible]);

  async function handleSubmit() {
    if (!title.trim()) { setError('Please add a title.'); return; }
    if (!selectedOrg)  { setError('Please select which mosque this event is for.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await submitEvent({
        placeId:     selectedOrg.placeId,
        orgName:     selectedOrg.name,
        title:       title.trim(),
        description: description.trim() || null,
        eventDate:   date.trim() || null,
        eventTime:   time.trim() || null,
        location:    location.trim() || null,
        category,
        postedBy:    currentUserId,
      });
      onSubmitted();
    } catch (e) {
      setError('Could not post event. Please try again.');
    }
    setSubmitting(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={smStyles.overlay} activeOpacity={1} onPress={onClose} />
        <View style={smStyles.sheet}>
          <View style={smStyles.handle} />
          <Text style={smStyles.title}>Post an Event</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Mosque selector */}
            {communities.length > 1 && (
              <>
                <Text style={smStyles.label}>MOSQUE / ORGANISATION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                  {communities.map(c => (
                    <TouchableOpacity
                      key={c.placeId}
                      style={[smStyles.orgPill, selectedOrg?.placeId === c.placeId && smStyles.orgPillActive]}
                      onPress={() => setSelectedOrg(c)}
                      activeOpacity={0.75}
                    >
                      <Text style={[smStyles.orgPillText, selectedOrg?.placeId === c.placeId && smStyles.orgPillTextActive]} numberOfLines={1}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            {communities.length === 1 && (
              <View style={smStyles.singleOrg}>
                <Ionicons name="business-outline" size={14} color="#2E7D62" />
                <Text style={smStyles.singleOrgText}>Posting to: {communities[0].name}</Text>
              </View>
            )}

            <Text style={smStyles.label}>EVENT TITLE *</Text>
            <TextInput style={smStyles.input} value={title} onChangeText={setTitle} placeholder="e.g. Youth Halaqa — Every Friday" placeholderTextColor="#9CA3AF" />

            <Text style={smStyles.label}>DESCRIPTION</Text>
            <TextInput style={[smStyles.input, smStyles.inputMulti]} value={description} onChangeText={setDescription} placeholder="What is this event about?" placeholderTextColor="#9CA3AF" multiline />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={smStyles.label}>DATE</Text>
                <TextInput style={smStyles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={smStyles.label}>TIME</Text>
                <TextInput style={smStyles.input} value={time} onChangeText={setTime} placeholder="7:00 PM" placeholderTextColor="#9CA3AF" />
              </View>
            </View>

            <Text style={smStyles.label}>LOCATION</Text>
            <TextInput style={smStyles.input} value={location} onChangeText={setLocation} placeholder="At the mosque / address" placeholderTextColor="#9CA3AF" />

            <Text style={smStyles.label}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {EVENT_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[smStyles.catChip, category === cat && smStyles.catChipActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[smStyles.catChipText, category === cat && smStyles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {error ? <Text style={smStyles.error}>{error}</Text> : null}

            <TouchableOpacity style={smStyles.submitBtn} onPress={handleSubmit} activeOpacity={0.85} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#FFF" />
                : <Text style={smStyles.submitBtnText}>Post to {selectedOrg?.name ?? 'Community'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── VerifyEventModal ─────────────────────────────────────────────────────────
function VerifyEventModal({ visible, event: ev, currentUserId, myVerdict, onClose, onVerified }) {
  if (!ev) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={vmStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={vmStyles.sheet}>
        <View style={vmStyles.handle} />
        <Text style={vmStyles.title}>Help verify this event</Text>
        <Text style={vmStyles.sub}>{ev.title}</Text>

        {[
          { verdict: 'confirmed', icon: 'call-outline',       label: 'I confirmed with the masjid' },
          { verdict: 'attended',  icon: 'checkmark-circle-outline', label: 'I attended — details were correct' },
          { verdict: 'incorrect', icon: 'close-circle-outline', label: 'This info is incorrect', danger: true },
        ].map(opt => (
          <TouchableOpacity
            key={opt.verdict}
            style={[vmStyles.option, myVerdict === opt.verdict && vmStyles.optionActive, opt.danger && vmStyles.optionDanger]}
            onPress={() => onVerified(opt.verdict)}
            activeOpacity={0.8}
          >
            <Ionicons name={opt.icon} size={18} color={opt.danger ? '#DC2626' : myVerdict === opt.verdict ? '#2E7D62' : '#374151'} />
            <Text style={[vmStyles.optionText, opt.danger && { color: '#DC2626' }]}>{opt.label}</Text>
            {myVerdict === opt.verdict && <Ionicons name="checkmark" size={16} color="#2E7D62" />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ─── Local component styles ───────────────────────────────────────────────────

const lcStyles = StyleSheet.create({
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 48, marginBottom: 16 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 8, textAlign: 'center' },
  emptySub:       { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  emptyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1B3D2F', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  emptyBtnText:   { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  pillScroll:     { height: 48, flexGrow: 0 },
  pillRow:        { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  pill:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  pillActive:     { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  pillText:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  pillTextActive: { color: '#FFFFFF' },
  // Banner
  banner:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F2F4', gap: 12 },
  bannerLeft:     { flex: 1 },
  bannerLabel:    { fontSize: 9, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 3 },
  bannerMsg:      { fontSize: 12, color: '#374151', fontWeight: '500', lineHeight: 17 },
  bannerRight:    { alignItems: 'flex-end' },
  bannerBtns:     { flexDirection: 'row', gap: 8 },
  noLinksCol:     { alignItems: 'flex-end', gap: 5 },
  noLinksText:    { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' },
  noLinksActions: { flexDirection: 'row', gap: 12 },
  infoOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  infoCard:       { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%' },
  infoCardTitle:  { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 12 },
  infoCardBody:   { fontSize: 14, color: '#4B5563', lineHeight: 22, marginBottom: 20 },
  infoCardBtn:    { backgroundColor: '#1B3D2F', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  infoCardBtnText:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  socialBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  fbBtn:          { backgroundColor: '#1877F2' },
  igBtn:          { backgroundColor: '#C13584' },
  socialBtnText:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  retryBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retryBtnText:   { fontSize: 12, color: '#2E7D62', fontWeight: '600' },
  // Manual entry
  manualSheet:    { backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 16, gap: 10 },
  manualTitle:    { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  socialInput:    { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#1A1A2E' },
  socialError:    { fontSize: 12, color: '#DC2626' },
  socialSaveBtn:     { backgroundColor: '#1B3D2F', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  socialSaveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  // WebView
  webSpinnerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  webLoadingText:    { marginTop: 12, fontSize: 14, color: '#6B7280' },
  webLoadingTitle:   { marginTop: 14, fontSize: 15, fontWeight: '600', color: '#1A1A2E', textAlign: 'center', paddingHorizontal: 32 },
  webLoadingSubtext: { marginTop: 6, fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 40 },
  noWebsiteText:  { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32, marginTop: 12 },
  openWebBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#1B3D2F', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  openWebBtnText: { fontSize: 15, fontWeight: '600', color: '#1B3D2F' },
});

const reqStyles = StyleSheet.create({
  // Request cards
  card:            { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardAccent:      { width: 4, backgroundColor: '#2E7D62' },
  cardBody:        { flex: 1, padding: 14 },
  cardTop:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatarWrap:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDF7F2', alignItems: 'center', justifyContent: 'center' },
  cardAuthor:      { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  cardTime:        { fontSize: 11, color: '#9CA3AF' },
  replyBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EDF7F2', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  replyBadgeText:  { fontSize: 12, fontWeight: '700', color: '#2E7D62' },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  cardDesc:        { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 8 },
  tapHint:         { fontSize: 12, color: '#9CA3AF' },
  // Detail modal
  detailRequest:   { backgroundColor: '#F0F9F5', borderRadius: 14, margin: 16, padding: 16 },
  detailAuthor:    { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  detailTitle:     { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  detailDesc:      { fontSize: 14, color: '#374151', lineHeight: 20 },
  repliesHeader:   { fontSize: 13, fontWeight: '700', color: '#6B7280', marginHorizontal: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  repliesEmpty:    { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 32 },
  repliesEmptyText:{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 4 },
  replyCard:       { backgroundColor: '#FFFFFF', borderRadius: 14, marginHorizontal: 16, marginBottom: 10, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  replyCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  replyAuthor:     { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  replyTime:       { fontSize: 11, color: '#9CA3AF' },
  replyCatChip:    { alignSelf: 'flex-start', backgroundColor: '#EDF7F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  replyCatText:    { fontSize: 11, fontWeight: '600', color: '#2E7D62' },
  replyTitle:      { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 2 },
  replyUrl:        { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  replyComment:    { fontSize: 13, color: '#374151', fontStyle: 'italic', marginBottom: 10, lineHeight: 18 },
  replyActions:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  replyActionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  replyActionBtnAgree: { backgroundColor: '#2E7D62', borderColor: '#2E7D62' },
  replyActionBtnWarn:  { backgroundColor: '#D97706', borderColor: '#D97706' },
  replyActionText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  detailFabWrap:   { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'transparent' },
  detailFab:       { backgroundColor: '#1B3D2F', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  detailFabText:   { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  // Community splash
  splashOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  splashSheet:     { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  splashIconRow:   { alignItems: 'center', marginBottom: 10 },
  splashTitle:     { fontSize: 22, fontWeight: '800', color: '#1A1A2E', textAlign: 'center', marginBottom: 12 },
  splashHadith:    { fontSize: 14, fontStyle: 'italic', color: '#1B3D2F', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8, marginBottom: 4 },
  splashHadithSrc: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  splashBody:      { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  splashToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 20 },
  splashToggleLabel:{ fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  splashToggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  splashBtn:       { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  splashBtnText:   { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  // Warn modal
  warnSheet:       { backgroundColor: '#FFFFFF', borderRadius: 20, margin: 24, padding: 24 },
  warnTitle:       { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  warnSub:         { fontSize: 13, color: '#6B7280' },
  warnActions:     { flexDirection: 'row', gap: 10, marginTop: 16 },
  warnCancel:      { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  warnCancelText:  { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  warnConfirm:     { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#D97706' },
  warnConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});

const ecStyles = StyleSheet.create({
  card:         { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  badge:        { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  badgeIcon:    { fontSize: 12 },
  badgeLabel:   { fontSize: 11, fontWeight: '700' },
  title:        { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  desc:         { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 8 },
  metaRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaItem:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:     { fontSize: 12, color: '#6B7280' },
  categoryChip: { backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  categoryText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  warningBox:   { backgroundColor: '#FEF9F0', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: '#F59E0B', marginBottom: 10 },
  warningTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  contactBlock: { gap: 4 },
  contactOrg:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 2 },
  contactLine:  { fontSize: 12, color: '#6B7280' },
  contactLink:  { fontSize: 12, color: '#2E7D62', fontWeight: '600' },
  confirmedBox: { backgroundColor: '#FDF3E3', borderRadius: 10, padding: 10, marginBottom: 10 },
  confirmedText:{ fontSize: 12, color: '#92400E' },
  verifyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 4 },
  verifyBtnDone:{ opacity: 0.7 },
  verifyBtnText:{ fontSize: 13, fontWeight: '600', color: '#6B7280' },
});

const smStyles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:     { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  title:     { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 16 },
  label:     { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 6 },
  input:     { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1A1A2E', marginBottom: 14 },
  inputMulti:{ minHeight: 80, textAlignVertical: 'top' },
  orgPill:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  orgPillActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  orgPillText:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  orgPillTextActive: { color: '#FFF' },
  singleOrg: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDF7F2', borderRadius: 10, padding: 10, marginBottom: 14 },
  singleOrgText: { fontSize: 13, color: '#2E7D62', fontWeight: '600' },
  catChip:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  catChipActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  catChipText:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catChipTextActive: { color: '#FFF' },
  error:     { fontSize: 13, color: '#DC2626', marginBottom: 12 },
  submitBtn: { backgroundColor: '#1B3D2F', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

const vmStyles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:    { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  title:    { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  sub:      { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  option:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionActive: { backgroundColor: '#F0F7F4' },
  optionDanger: {},
  optionText:   { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
});

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#1B3D2F',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40,
    zIndex: 100,
  },
  loadingOverlayTitle: {
    fontSize: 13, fontWeight: '700', letterSpacing: 2.5,
    color: 'rgba(255,255,255,0.35)', textAlign: 'center',
    textTransform: 'uppercase', marginBottom: 20,
  },
  loadingOverlayHadith: {
    fontSize: 24, fontWeight: '700', letterSpacing: 0.3,
    color: '#FFFFFF', textAlign: 'center', lineHeight: 36,
    fontStyle: 'italic',
  },
  loadingOverlayAttribution: {
    fontSize: 13, fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16, textAlign: 'center', letterSpacing: 0.5,
  },
  overlayBtn: {
    marginTop: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  overlayBtnText: {
    fontSize: 15, fontWeight: '700', color: '#1B3D2F',
  },
  loadingOverlayTagline: {
    fontSize: 13, fontWeight: '600', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 32, textAlign: 'center', textTransform: 'uppercase',
  },
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: '#1B3D2F' },
  sheet: { flex: 1, backgroundColor: '#F5F6F8', overflow: 'hidden' },

  // ── Tab bar ──
  // ── Header tab switcher ──
  tabHeader: {
    backgroundColor: '#1B3D2F',
    paddingBottom: 12,
  },
  tabSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 2,
    paddingBottom: 4,
    letterSpacing: 0.1,
  },
  tabSubtitleMain: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    letterSpacing: 0.1,
    marginBottom: 3,
  },
  tabSubtitleSub: {
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  tabRow: {
    paddingHorizontal: 20, gap: 28, alignItems: 'center',
  },
  tabBtn: {
    paddingVertical: 16, alignItems: 'center', position: 'relative',
  },
  tabBtnLabel: {
    fontSize: 16, fontWeight: '600',
    color: 'rgba(255,255,255,0.4)', letterSpacing: 0.2,
  },
  tabBtnLabelActive: {
    color: '#FFFFFF', fontWeight: '700',
  },
  tabBtnUnderline: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    height: 3, borderRadius: 2, backgroundColor: '#FFFFFF',
  },
  tabNewDot: {
    position: 'absolute', top: 10, right: -10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4ADE80',
    borderWidth: 1.5, borderColor: '#1B3D2F',
  },

  // ── Du'a / Win cards ──
  duaCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  duaCardAccent: { width: 4, backgroundColor: '#1B3D2F' },
  winCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  winCardAccent: { width: 4, backgroundColor: '#D4871A' },
  duaBody: { flex: 1, padding: 14 },
  duaTop: { marginBottom: 8 },
  duaAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  duaAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center',
  },
  duaAvatarText: { fontSize: 18 },
  duaAuthor: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  duaTime: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  winTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  duaText: { fontSize: 15, color: '#374151', lineHeight: 23, marginBottom: 12 },
  duaActions: { flexDirection: 'row', gap: 8 },
  duaReactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100,
    backgroundColor: 'rgba(27,61,47,0.07)',
  },
  duaReactBtnActive: { backgroundColor: '#1B3D2F' },
  duaFeelYouActive: { backgroundColor: '#16A34A' },
  winHeartActive: { backgroundColor: '#D4871A' },
  duaReactIcon: { fontSize: 14 },
  duaReactText: { fontSize: 12, fontWeight: '600', color: '#1B3D2F' },
  duaReactTextActive: { color: '#FFFFFF' },

  // ── Anonymous toggle ──
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  anonCheck: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center',
  },
  anonCheckActive: { backgroundColor: '#1B3D2F', borderColor: '#1B3D2F' },
  anonLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },

  // ── Controls ──
  controls: {
    backgroundColor: '#F5F6F8',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: { fontSize: 14, color: '#1A1A2E', flex: 1 },
  searchPlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0,
    fontSize: 14, color: '#9CA3AF',
  },
  filterRow: { paddingHorizontal: 4, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#E8EAED' },
  filterChipActive: { backgroundColor: '#1B3D2F' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF' },

  // ── Empty ──
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  loadingMsg: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 14, lineHeight: 22 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151', textAlign: 'center' },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  // ── Saved insight cards ──
  listContent: { paddingHorizontal: 20, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardType: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4, lineHeight: 21 },
  cardPreview: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 10 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: '600' },

  // ── Community resource cards ──
  resourceCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  resourceAccent: { width: 4 },
  resourceBody: { flex: 1, padding: 14 },
  resourceCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resourceCatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  resourceCatText: { fontSize: 11, fontWeight: '700' },
  resourceAge: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  resourceTime: { fontSize: 11, color: '#C4C9D4', fontWeight: '500', marginLeft: 'auto' },
  resourceCardColumn: { flexDirection: 'column' },
  resourceThumb: { width: '100%', height: 160, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: '#F3F4F6' },
  resourceThumbAccent: { height: 3, width: '100%' },
  resourceTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', lineHeight: 21, marginBottom: 4 },
  resourcePostedBy: { fontSize: 12, color: '#9CA3AF', fontWeight: '500', marginBottom: 8 },
  ownerActionText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  rejectionNote: { fontSize: 12, color: '#DC2626', lineHeight: 18, marginBottom: 8, fontStyle: 'italic' },
  recommendCount: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  recommendCountText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  resourceWhy: { fontSize: 13, color: '#6B7280', lineHeight: 20, fontStyle: 'italic', marginBottom: 12 },
  resourceActions: { flexDirection: 'row', gap: 8 },
  recommendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: 'rgba(27,61,47,0.07)',
  },
  recommendBtnActive: { backgroundColor: '#1B3D2F' },
  recommendBtnText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100,
    backgroundColor: 'rgba(27,61,47,0.07)',
  },
  saveBtnActive: { backgroundColor: '#1B3D2F' },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: '#1B3D2F' },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100,
    backgroundColor: '#1B3D2F',
  },
  openBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  // ── FAB ──
  fab: {
    position: 'absolute', right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1B3D2F', borderRadius: 100,
    paddingVertical: 13, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  fabText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // ── Submit modal ──
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F1F3',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  modalScroll: { paddingHorizontal: 20, paddingTop: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  fieldLabelOptional: { fontWeight: '400', color: '#9CA3AF' },
  textInput: {
    backgroundColor: '#F5F6F8', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1C1C1E', marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  reflectionTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#F5F6F8', marginBottom: 8,
  },
  reflectionTagActive: { borderColor: '#2E7D62', backgroundColor: '#E8F5EF' },
  reflectionTagText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  reflectionTagTextActive: { color: '#2E7D62' },
  thumbPreviewWrap: { marginBottom: 20 },
  thumbPreviewCard: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  thumbPreviewImg: { width: '100%', height: 160 },
  thumbPreviewRemoved: {
    width: '100%', height: 100,
    backgroundColor: '#F5F6F8',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  thumbPreviewRemovedText: { fontSize: 12, color: '#9CA3AF' },
  thumbToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    padding: 10, borderTopWidth: 1, borderTopColor: '#F0F1F3',
  },
  thumbToggleText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  submitError: { fontSize: 13, color: '#DC2626', marginBottom: 12, lineHeight: 19 },
  submitBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  submitNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 10 },

  // ── Success state ──
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  successIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#E8F5EF', alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  successBody: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 23 },
  successBtn: {
    backgroundColor: '#1B3D2F', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 40, marginTop: 8,
  },
  successBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
