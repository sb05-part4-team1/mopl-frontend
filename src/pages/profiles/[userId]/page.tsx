import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useUserProfileStore from '@/lib/stores/useUserProfileStore';
import useAuthStore from '@/lib/stores/useAuthStore';
import usePlaylistStore from '@/lib/stores/usePlaylistStore';
import usePlaylistSubscriptionStore from '@/lib/stores/usePlaylistSubscriptionStore';
import { getWatchingSessionByWatcher } from '@/lib/api/watching-sessions';
import { isFollowedByMe, createFollow, cancelFollow, getFollowerCount } from '@/lib/api/follows';
import { updateUser } from '@/lib/api/users';
import type { WatchingSessionDto } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import icProfileDefault from '@/assets/ic_profile_default.svg';
import PlaylistCard from '@/pages/playlists/components/PlaylistCard';

function PlaylistCardSkeleton() {
  return (
    <div className="w-full h-[250px] rounded-[24px] bg-gray-800 animate-pulse border border-gray-700">
      <div className="p-8 flex items-start justify-between h-full">
        <div className="flex-1 flex flex-col justify-between h-full pr-6">
          <div>
            <div className="h-7 bg-gray-700 rounded-md w-48 mb-5" />
            <div className="h-5 bg-gray-700 rounded-md w-64 mb-2" />
            <div className="h-5 bg-gray-700 rounded-md w-32" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-700 rounded-md w-20" />
            <div className="h-4 bg-gray-700 rounded-md w-16" />
          </div>
        </div>
        <div className="w-[130px] h-[190px] bg-gray-700 rounded-[16px]" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  // Stores
  const { data: profile, loading: profileLoading, error, updateParams, clear } = useUserProfileStore();
  const { data: jwt } = useAuthStore();
  const {
    data: ownedPlaylists,
    loading: ownedPlaylistsLoading,
    updateParams: updateOwnedPlaylistsParams,
    clear: clearOwnedPlaylists,
    count: ownedPlaylistsCount,
    hasNext: hasNextOwnedPlaylists,
    fetchMore: fetchMoreOwnedPlaylists,
  } = usePlaylistStore();
  const {
    data: subscribedPlaylists,
    loading: subscribedPlaylistsLoading,
    updateParams: updateSubscribedPlaylistsParams,
    clear: clearSubscribedPlaylists,
    count: subscribedPlaylistsCount,
    hasNext: hasNextSubscribedPlaylists,
    fetchMore: fetchMoreSubscribedPlaylists,
  } = usePlaylistSubscriptionStore();

  // Local state
  const [currentlyWatching, setCurrentlyWatching] = useState<WatchingSessionDto | null>(null);
  const [watchingLoading, setWatchingLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followId, setFollowId] = useState<string | null>(null);
  const ownedPlaylistsTotal = ownedPlaylistsCount();
  const subscribedPlaylistsTotal = subscribedPlaylistsCount();

  // Edit mode state
  type ProfileMode = 'view' | 'edit';
  const [mode, setMode] = useState<ProfileMode>('view');
  const [editName, setEditName] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs for infinite scroll
  const ownedPlaylistsScrollRef = useRef<HTMLDivElement>(null);
  const subscribedPlaylistsScrollRef = useRef<HTMLDivElement>(null);

  // Check if viewing own profile
  const isOwnProfile = profile && jwt ? profile.id === jwt.userDto.id : false;

  // Fetch user profile
  useEffect(() => {
    if (!userId) return;

    updateParams({ userId });

    return () => {
      clear();
    };
  }, [userId, updateParams, clear]);

  // Fetch currently watching content
  useEffect(() => {
    if (!userId) return;

    const fetchWatchingSession = async () => {
      setWatchingLoading(true);
      try {
        const session = await getWatchingSessionByWatcher(userId);
        setCurrentlyWatching(session);
      } catch (error) {
        console.error('Failed to fetch watching session:', error);
      } finally {
        setWatchingLoading(false);
      }
    };

    fetchWatchingSession();
  }, [userId]);

  // Fetch follow status and follower count
  useEffect(() => {
    if (!userId || isOwnProfile) return;

    const fetchFollowStatus = async () => {
      try {
        const [followed, count] = await Promise.all([
          isFollowedByMe(userId),
          getFollowerCount(userId),
        ]);
        setIsFollowing(followed);
        setFollowerCount(count);
      } catch (error) {
        console.error('Failed to fetch follow status:', error);
      }
    };

    fetchFollowStatus();
  }, [userId, isOwnProfile]);

  // Fetch owned playlists
  useEffect(() => {
    if (!userId) return;

    updateOwnedPlaylistsParams({
      ownerIdEqual: userId,
    });

    return () => {
      clearOwnedPlaylists();
    };
  }, [userId, updateOwnedPlaylistsParams, clearOwnedPlaylists]);

  // Fetch subscribed playlists
  useEffect(() => {
    if (!userId) return;

    updateSubscribedPlaylistsParams({
      subscriberIdEqual: userId,
    });

    return () => {
      clearSubscribedPlaylists();
    };
  }, [userId, updateSubscribedPlaylistsParams, clearSubscribedPlaylists]);

  // Infinite scroll handler for owned playlists
  const handleOwnedPlaylistsScroll = useCallback(() => {
    const container = ownedPlaylistsScrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (scrolledToBottom && hasNextOwnedPlaylists() && !ownedPlaylistsLoading) {
      fetchMoreOwnedPlaylists();
    }
  }, [hasNextOwnedPlaylists, ownedPlaylistsLoading, fetchMoreOwnedPlaylists]);

  // Infinite scroll handler for subscribed playlists
  const handleSubscribedPlaylistsScroll = useCallback(() => {
    const container = subscribedPlaylistsScrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (scrolledToBottom && hasNextSubscribedPlaylists() && !subscribedPlaylistsLoading) {
      fetchMoreSubscribedPlaylists();
    }
  }, [hasNextSubscribedPlaylists, subscribedPlaylistsLoading, fetchMoreSubscribedPlaylists]);

  // Attach scroll listeners
  useEffect(() => {
    const ownedContainer = ownedPlaylistsScrollRef.current;
    if (ownedContainer) {
      ownedContainer.addEventListener('scroll', handleOwnedPlaylistsScroll);
      return () => ownedContainer.removeEventListener('scroll', handleOwnedPlaylistsScroll);
    }
  }, [handleOwnedPlaylistsScroll]);

  useEffect(() => {
    const subscribedContainer = subscribedPlaylistsScrollRef.current;
    if (subscribedContainer) {
      subscribedContainer.addEventListener('scroll', handleSubscribedPlaylistsScroll);
      return () => subscribedContainer.removeEventListener('scroll', handleSubscribedPlaylistsScroll);
    }
  }, [handleSubscribedPlaylistsScroll]);

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!userId || followLoading) return;

    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        if (followId) {
          await cancelFollow(followId);
          setIsFollowing(false);
          setFollowerCount((prev) => prev - 1);
          toast.success('언팔로우했습니다');
        }
      } else {
        // Follow
        const result = await createFollow({ followeeId: userId });
        setFollowId(result.id);
        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
        toast.success('팔로우했습니다');
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      toast.error(isFollowing ? '언팔로우에 실패했습니다' : '팔로우에 실패했습니다');
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle enter edit mode
  const handleEnterEditMode = () => {
    if (!profile) return;
    setMode('edit');
    setEditName(profile.name);
    setEditImagePreview(profile.profileImageUrl || null);
    setEditImageFile(null);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setMode('view');
    setEditName('');
    setEditImageFile(null);
    setEditImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다');
      return;
    }

    setEditImageFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    if (!profile || !userId) return;

    // Validate name
    if (editName.trim().length < 2) {
      toast.error('이름은 최소 2자 이상이어야 합니다');
      return;
    }

    setIsUpdating(true);
    try {
      // 1. Call API directly
      const updatedUser = await updateUser(
        userId,
        { name: editName.trim() },
        editImageFile || undefined
      );

      // 2. Sync stores
      useUserProfileStore.getState().update(updatedUser);

      // Sync auth store if editing own profile
      if (isOwnProfile && jwt) {
        useAuthStore.getState().update({
          userDto: updatedUser,
        });
      }

      // 3. Success handling
      toast.success('프로필이 업데이트되었습니다');
      setMode('view');
      setEditImageFile(null);
      setEditImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('프로필 업데이트에 실패했습니다');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle send message (placeholder)
  const handleSendMessage = () => {
    navigate(`/conversations/with?userId=${userId}`);
  };

  // Handle content click
  const handleContentClick = (contentId: string) => {
    navigate(`/contents/${contentId}`);
  };

  // Loading state
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-body1-m text-gray-300">{error || '사용자를 찾을 수 없습니다'}</p>
        <Button onClick={() => navigate(-1)}>뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <div className="max-w-[1680px] mx-auto px-[70px] py-[60px]">
        {/* Profile Header */}
        <div className="flex items-center gap-6 mb-[60px]">
          {/* Avatar */}
          <div className="relative size-[110px] rounded-full overflow-hidden bg-gray-700 border border-gray-800 shrink-0">
            {mode === 'edit' ? (
              <>
                <img
                  src={editImagePreview || icProfileDefault}
                  alt={editName}
                  className="size-full object-cover"
                />
                <label
                  htmlFor="profile-image-input"
                  className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer hover:bg-black/60 transition-colors"
                >
                  <span className="text-body3-sb text-white">변경</span>
                </label>
                <input
                  ref={fileInputRef}
                  id="profile-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </>
            ) : (
              <img
                src={profile.profileImageUrl || icProfileDefault}
                alt={profile.name}
                className="size-full object-cover"
              />
            )}
          </div>

          {/* Profile Info */}
          <div className="flex flex-col gap-4">
            {/* Name and Action Buttons */}
            <div className="flex items-center gap-[14px]">
              {mode === 'edit' ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="이름 입력"
                    className={cn(
                      'h-[42px] w-[280px] rounded-xl border-[1.5px]',
                      'border-gray-700 bg-gray-800/50 px-4 text-body1-m text-white',
                      'placeholder:text-gray-400 focus:border-pink-500'
                    )}
                  />
                  <div className="flex items-center gap-[10px]">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isUpdating || editName.trim().length < 2}
                      className="h-[34px] px-3 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-800 disabled:text-gray-600"
                    >
                      <span className="text-body3-b text-white">
                        {isUpdating ? '저장 중...' : '저장'}
                      </span>
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      disabled={isUpdating}
                      className="h-[34px] px-3 border border-gray-700 bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
                    >
                      <span className="text-body3-b">취소</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-header1-sb text-gray-50">{profile.name}</h1>

                  {/* Conditional Buttons */}
                  {isOwnProfile ? (
                    // Own profile - Edit button only
                    <Button
                      onClick={handleEnterEditMode}
                      className="h-[34px] px-3 border border-gray-700 bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      <span className="text-body3-b">수정</span>
                    </Button>
                  ) : (
                    // Other's profile - Follow and Message buttons
                    <div className="flex items-center gap-[10px]">
                      <Button
                        onClick={handleFollowToggle}
                        disabled={followLoading}
                        className={
                          isFollowing
                            ? 'h-[34px] px-3 bg-gray-800 hover:bg-gray-700'
                            : 'h-[34px] px-3 bg-pink-500 hover:bg-pink-600'
                        }
                      >
                        <span className="text-body3-b text-white">
                          {followLoading ? '...' : isFollowing ? '팔로잉' : '팔로우'}
                        </span>
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleSendMessage}
                        className="h-[34px] px-3 bg-gray-700 hover:bg-gray-600"
                      >
                        <span className="text-body3-b">메시지 보내기</span>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Follower Stats */}
            <div className="flex items-center gap-1">
              <span className="text-body1-m text-gray-300">팔로우</span>
              <span className="text-title1-sb text-gray-100">{followerCount.toLocaleString()}</span>
            </div>

            {/* Currently Watching (if exists) */}
            {watchingLoading ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner />
                <span className="text-body2-m text-gray-400">시청 정보 불러오는 중...</span>
              </div>
            ) : (
              currentlyWatching && (
                <p className="text-body2-m">
                  <span className="text-gray-400">지금 </span>
                  <button
                    onClick={() => handleContentClick(currentlyWatching.content.id)}
                    className="text-gray-100 font-bold underline hover:text-gray-50 transition-colors cursor-pointer"
                  >
                    {currentlyWatching.content.title}
                  </button>
                  <span className="text-gray-400">를 보고 있습니다.</span>
                </p>
              )
            )}
          </div>
        </div>

        {/* Owned Playlists Section */}
        <section className="mb-[60px]">
          <div className="flex items-center gap-2 mb-[20px]">
            <h2 className="text-header1-sb text-gray-50">플레이리스트</h2>
            <span className="text-header1-sb text-gray-500">{ownedPlaylistsTotal}</span>
          </div>

          <div
            ref={ownedPlaylistsScrollRef}
            className="h-[300px] py-1 pl-2 overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          >
            {ownedPlaylistsLoading && ownedPlaylists.length === 0 ? (
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-[30px] gap-y-[40px]">
                {Array.from({ length: 6 }).map((_, index) => (
                  <PlaylistCardSkeleton key={index} />
                ))}
              </div>
            ) : ownedPlaylistsTotal === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-body1-m text-gray-400 mb-2">플레이리스트가 없습니다</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-[30px] gap-y-[40px]">
                {ownedPlaylists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
                {ownedPlaylistsLoading && ownedPlaylists.length > 0 && (
                  <>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <PlaylistCardSkeleton key={`skeleton-${index}`} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Subscribed Playlists Section */}
        <section>
          <div className="flex items-center gap-2 mb-[20px]">
            <h2 className="text-header1-sb text-gray-50">구독 중인 플레이리스트</h2>
            <span className="text-header1-sb text-gray-500">{subscribedPlaylistsTotal}</span>
          </div>

          <div
            ref={subscribedPlaylistsScrollRef}
            className="h-[300px] py-1 pl-2 overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          >
            {subscribedPlaylistsLoading && subscribedPlaylists.length === 0 ? (
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-[30px] gap-y-[40px]">
                {Array.from({ length: 6 }).map((_, index) => (
                  <PlaylistCardSkeleton key={index} />
                ))}
              </div>
            ) : subscribedPlaylistsTotal === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-body1-m text-gray-400 mb-2">구독 중인 플레이리스트가 없습니다</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-[30px] gap-y-[40px]">
                {subscribedPlaylists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
                {subscribedPlaylistsLoading && subscribedPlaylists.length > 0 && (
                  <>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <PlaylistCardSkeleton key={`skeleton-${index}`} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
