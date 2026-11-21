# 컴포넌트 Props 목록

`npm run docs:props`로 실제 TypeScript 선언에서 생성합니다. 데이터와 이벤트 콜백은 별도 필드입니다.
페이지 데이터 계약과 Promise/스켈레톤 사용법은 [API 연결 가이드](./api-props-and-loading.md)를 참고하세요.

총 210개 컴포넌트. 상세 필드 타입: [component-props.json](./component-props.json).

| 컴포넌트 | 공개 Props 타입 | 입력 필드 | 상태 연결 |
| --- | --- | --- | --- |
| [DonutChart](../src/components/charts/DonutChart/DonutChart.tsx) | `DonutChartProps` | title, rows, unit?, centerLabel?, formatValue? (콜백), showPercent? | props / UI 상태 |
| [HorizontalBarChart](../src/components/charts/HorizontalBarChart/HorizontalBarChart.tsx) | `HorizontalBarChartProps` | title, rows, unit?, formatValue? (콜백), maxValue? | props / UI 상태 |
| [HourlyPopulationChart](../src/components/charts/HourlyPopulationChart/HourlyPopulationChart.tsx) | `HourlyPopulationChartProps` | points, selectedHour, onSelectHour (콜백) | props / UI 상태 |
| [RangeChart](../src/components/charts/RangeChart/RangeChart.tsx) | `RangeChartProps` | title, min, median, max, value?, format? (콜백) | props / UI 상태 |
| [CallPreparation](../src/components/chat/CallPreparation/CallPreparation.tsx) | `CallPreparationProps` | cardId, guide, contact?, memo | props / UI 상태 |
| [ChatActionCard](../src/components/chat/ChatActionCard/ChatActionCard.tsx) | `ChatActionCardProps` | action, messageIndex, actionIndex, typeLabel? | props / UI 상태 |
| [ChatComposer](../src/components/chat/ChatComposer/ChatComposer.tsx) | `ChatComposerProps` | draft, busy | props / UI 상태 |
| [ChatConversation](../src/components/chat/ChatConversation/ChatConversation.tsx) | `ChatConversationProps` | storeName, undecided, messages, busy, request, cards, contacts, actionLabels, callGuides, memo | props / UI 상태 |
| [ChatHeader](../src/components/chat/ChatHeader/ChatHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [ChatLauncher](../src/components/chat/ChatLauncher/ChatLauncher.tsx) | `ChatLauncherProps` | open | props / UI 상태 |
| [ChatMessage](../src/components/chat/ChatMessage/ChatMessage.tsx) | `ChatMessageProps` | message, index, last, busy?, cards, contacts, actionLabels, callGuides, memo | props / UI 상태 |
| [ChatPanel](../src/components/chat/ChatPanel/ChatPanel.tsx) | `ChatPanelProps` | data?, loading?, error?, onRetry? (콜백), notice? | props / UI 상태 |
| [ChatPanelContent](../src/components/chat/ChatPanelContent/ChatPanelContent.tsx) | `ChatPanelContentProps` | data | props / UI 상태 |
| [ChatProcessing](../src/components/chat/ChatProcessing/ChatProcessing.tsx) | `ChatProcessingProps` | processing, actions?, messageIndex? | props / UI 상태 |
| [ChatProcessingStep](../src/components/chat/ChatProcessingStep/ChatProcessingStep.tsx) | `ChatProcessingStepProps` | label, detail?, state, last | props / UI 상태 |
| [ChatSubmitButton](../src/components/chat/ChatSubmitButton/ChatSubmitButton.tsx) | `ChatSubmitButtonProps` | busy, disabled | props / UI 상태 |
| [ChatSupportIcon](../src/components/chat/ChatSupportIcon/ChatSupportIcon.tsx) | `ChatSupportIconProps` | className? | props / UI 상태 |
| [ChatWelcome](../src/components/chat/ChatWelcome/ChatWelcome.tsx) | `ChatWelcomeProps` | storeName, undecided | props / UI 상태 |
| [ChatWidget](../src/components/chat/ChatWidget/ChatWidget.tsx) | `ChatWidgetProps` | open, onboarded, notice?, onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ConnectedChatWidget](../src/components/chat/ConnectedChatWidget/ConnectedChatWidget.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [FavoriteQuestions](../src/components/chat/FavoriteQuestions/FavoriteQuestions.tsx) | `FavoriteQuestionsProps` | questions?, busy? | props / UI 상태 |
| [MessageCitations](../src/components/chat/MessageCitations/MessageCitations.tsx) | `MessageCitationsProps` | citations | props / UI 상태 |
| [MessageText](../src/components/chat/MessageText/MessageText.tsx) | `MessageTextProps` | text | props / UI 상태 |
| [PinnedQuestion](../src/components/chat/PinnedQuestion/PinnedQuestion.tsx) | `PinnedQuestionProps` | title, verdict, verdictLabel | props / UI 상태 |
| [QuestionSuggestions](../src/components/chat/QuestionSuggestions/QuestionSuggestions.tsx) | `QuestionSuggestionsProps` | questions, busy? | props / UI 상태 |
| [CalendarAgendaCard](../src/components/checklist/CalendarAgendaCard/CalendarAgendaCard.tsx) | `CalendarAgendaCardProps` | selected, events, colors | props / UI 상태 |
| [CalendarDayCell](../src/components/checklist/CalendarDayCell/CalendarDayCell.tsx) | `CalendarDayCellProps` | day, colors | props / UI 상태 |
| [CalendarEventRow](../src/components/checklist/CalendarEventRow/CalendarEventRow.tsx) | `CalendarEventRowProps` | event, color | props / UI 상태 |
| [CalendarLegend](../src/components/checklist/CalendarLegend/CalendarLegend.tsx) | `CalendarLegendProps` | colors | props / UI 상태 |
| [CalendarMonthCard](../src/components/checklist/CalendarMonthCard/CalendarMonthCard.tsx) | `CalendarMonthCardProps` | year, month, days, colors | props / UI 상태 |
| [ChecklistHeader](../src/components/checklist/ChecklistHeader/ChecklistHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [ChecklistPage](../src/components/checklist/ChecklistPage/ChecklistPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [ChecklistProgress](../src/components/checklist/ChecklistProgress/ChecklistProgress.tsx) | `ChecklistProgressProps` | opening, done, total | props / UI 상태 |
| [ChecklistView](../src/components/checklist/ChecklistView.tsx) | `ChecklistViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ChecklistViewTabs](../src/components/checklist/ChecklistViewTabs/ChecklistViewTabs.tsx) | `ChecklistViewTabsProps` | view | props / UI 상태 |
| [OpeningDateDialog](../src/components/checklist/OpeningDateDialog/OpeningDateDialog.tsx) | `OpeningDateDialogProps` | opening | props / UI 상태 |
| [TaskGroupCard](../src/components/checklist/TaskGroupCard/TaskGroupCard.tsx) | `TaskGroupCardProps` | group | props / UI 상태 |
| [TaskMetadata](../src/components/checklist/TaskMetadata/TaskMetadata.tsx) | `TaskMetadataProps` | task, contact | props / UI 상태 |
| [TaskRow](../src/components/checklist/TaskRow/TaskRow.tsx) | `TaskRowProps` | task, contact, deadline, documentCount | props / UI 상태 |
| [AnalysisStatusItem](../src/components/common/AnalysisStatusItem/AnalysisStatusItem.tsx) | `AnalysisStatusItemProps` | label, index, complete, running, completeLabel? | props / UI 상태 |
| [MetricCard](../src/components/common/MetricCard/MetricCard.tsx) | `MetricCardProps` | label, value, caption? | props / UI 상태 |
| [PageHeader](../src/components/common/PageHeader/PageHeader.tsx) | `PageHeaderProps` | eyebrow, title, description, actions? | props / UI 상태 |
| [PhoneContact](../src/components/common/PhoneContact/PhoneContact.tsx) | `PhoneContactProps` | contact? | props / UI 상태 |
| [ActionItem](../src/components/dashboard/ActionItem/ActionItem.tsx) | `ActionItemProps` | item | props / UI 상태 |
| [DashboardMetrics](../src/components/dashboard/DashboardMetrics/DashboardMetrics.tsx) | `DashboardMetricsProps` | undecided, decisions, tasks, unread | props / UI 상태 |
| [DashboardPage](../src/components/dashboard/DashboardPage/DashboardPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [DashboardView](../src/components/dashboard/DashboardView.tsx) | `DashboardViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [DecisionItem](../src/components/dashboard/DecisionItem/DecisionItem.tsx) | `DecisionItemProps` | card | props / UI 상태 |
| [DecisionList](../src/components/dashboard/DecisionList/DecisionList.tsx) | `DecisionListProps` | cards, undecided | props / UI 상태 |
| [StoreSummary](../src/components/dashboard/StoreSummary/StoreSummary.tsx) | `StoreSummaryProps` | store, name, days, undecided | props / UI 상태 |
| [TaskItem](../src/components/dashboard/TaskItem/TaskItem.tsx) | `TaskItemProps` | task | props / UI 상태 |
| [TaskList](../src/components/dashboard/TaskList/TaskList.tsx) | `TaskListProps` | actions, tasks | props / UI 상태 |
| [DocRow](../src/components/docs/DocRow/DocRow.tsx) | `DocRowProps` | document, contact? | props / UI 상태 |
| [DocsHeader](../src/components/docs/DocsHeader/DocsHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [DocsPage](../src/components/docs/DocsPage/DocsPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [DocsSummary](../src/components/docs/DocsSummary/DocsSummary.tsx) | `DocsSummaryProps` | total, finished, remaining | props / UI 상태 |
| [DocsView](../src/components/docs/DocsView/DocsView.tsx) | `DocsViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [DocTaskCard](../src/components/docs/DocTaskCard/DocTaskCard.tsx) | `DocTaskCardProps` | row, contacts | props / UI 상태 |
| [Modal](../src/components/feedback/Modal/Modal.tsx) | `ModalProps` | title, children, onClose (콜백) | props / UI 상태 |
| [Toast](../src/components/feedback/Toast/Toast.tsx) | `ToastProps` | message | props / UI 상태 |
| [FootTrafficMap](../src/components/foot-traffic/FootTrafficMap/FootTrafficMap.tsx) | `FootTrafficMapProps` | appKey?, dataSource?, dataset?, loading?, error?, onRetry? (콜백), center, onCenterChange (콜백), radius, onRadiusChange (콜백), shops, selectedShopId, onSelectShop (콜백), address?, settingsOpen, onSettingsOpenChange (콜백), hour, lastHour, onHourChange (콜백) | props / UI 상태 |
| [MapAvailability](../src/components/foot-traffic/MapAvailability/MapAvailability.tsx) | `MapAvailabilityProps` | state | props / UI 상태 |
| [MapCanvas](../src/components/foot-traffic/MapCanvas/MapCanvas.tsx) | `MapCanvasProps` | appKey, center, radius, level, lines, cells, cuts, label, hour, shops, selectedShopId, address?, onSelectShop (콜백), onCenterChange (콜백), onLevelChange (콜백), onRegionChange (콜백), onAddressStatusChange (콜백) | props / UI 상태 |
| [MapControls](../src/components/foot-traffic/MapControls/MapControls.tsx) | `MapControlsProps` | open, onOpenChange (콜백), category, sub, hour, lastHour, radius, shown, region, onCategoryChange (콜백), onSubChange (콜백), onHourChange (콜백), onRadiusChange (콜백), onToggle (콜백) | props / UI 상태 |
| [MapDataStatus](../src/components/foot-traffic/MapDataStatus/MapDataStatus.tsx) | `MapDataStatusProps` | loading, error, addressStatus, retry (콜백) | props / UI 상태 |
| [MapZoomControls](../src/components/foot-traffic/MapZoomControls/MapZoomControls.tsx) | `MapZoomControlsProps` | level, onChange (콜백) | props / UI 상태 |
| [PopulationCategory](../src/components/foot-traffic/PopulationCategory/PopulationCategory.tsx) | `PopulationCategoryProps` | category, sub, onSubChange (콜백) | props / UI 상태 |
| [PopulationCategoryTabs](../src/components/foot-traffic/PopulationCategoryTabs/PopulationCategoryTabs.tsx) | `PopulationCategoryTabsProps` | category, onChange (콜백) | props / UI 상태 |
| [PopulationLegend](../src/components/foot-traffic/PopulationLegend/PopulationLegend.tsx) | `PopulationLegendProps` | category, label, hour, date, radius, cuts, summary, quality, loading, hasPublicValues, settingsOpen | props / UI 상태 |
| [PopulationRadius](../src/components/foot-traffic/PopulationRadius/PopulationRadius.tsx) | `PopulationRadiusProps` | radius, onChange (콜백) | props / UI 상태 |
| [PopulationTime](../src/components/foot-traffic/PopulationTime/PopulationTime.tsx) | `PopulationTimeProps` | hour, lastHour, onChange (콜백) | props / UI 상태 |
| [PopulationTooltip](../src/components/foot-traffic/PopulationTooltip/PopulationTooltip.tsx) | `PopulationTooltipProps` | value, level, label, hour | props / UI 상태 |
| [RoadPopulationLayer](../src/components/foot-traffic/RoadPopulationLayer/RoadPopulationLayer.tsx) | `RoadPopulationLayerProps` | lines, cuts, level, activeCell, onHover (콜백), onHitTestChange? (콜백) | props / UI 상태 |
| [ShopMapMarkers](../src/components/foot-traffic/ShopMapMarkers/ShopMapMarkers.tsx) | `ShopMapMarkersProps` | shops, selectedId, onSelect (콜백) | props / UI 상태 |
| [GrantCard](../src/components/grants/GrantCard/GrantCard.tsx) | `GrantCardProps` | grant, label, tone, deadline | props / UI 상태 |
| [GrantCardActions](../src/components/grants/GrantCardActions/GrantCardActions.tsx) | `GrantCardActionsProps` | id | props / UI 상태 |
| [GrantConditionQuote](../src/components/grants/GrantConditionQuote/GrantConditionQuote.tsx) | `GrantConditionQuoteProps` | condition | props / UI 상태 |
| [GrantConditions](../src/components/grants/GrantConditions/GrantConditions.tsx) | `GrantConditionsProps` | checks | props / UI 상태 |
| [GrantDeadlineRow](../src/components/grants/GrantDeadlineRow/GrantDeadlineRow.tsx) | `GrantDeadlineRowProps` | grant, label, tone, deadline | props / UI 상태 |
| [GrantDetails](../src/components/grants/GrantDetails/GrantDetails.tsx) | `GrantDetailsProps` | grant, deadline, result | props / UI 상태 |
| [GrantDetailSummary](../src/components/grants/GrantDetailSummary/GrantDetailSummary.tsx) | `GrantDetailSummaryProps` | grant, result | props / UI 상태 |
| [GrantEligibility](../src/components/grants/GrantEligibility/GrantEligibility.tsx) | `GrantEligibilityProps` | label, tone, example? | props / UI 상태 |
| [GrantFiltersBar](../src/components/grants/GrantFiltersBar/GrantFiltersBar.tsx) | `GrantFiltersBarProps` | filters, categories | props / UI 상태 |
| [GrantFilterTabs](../src/components/grants/GrantFilterTabs/GrantFilterTabs.tsx) | `GrantFilterTabsProps` | options, filter, selected, style? | props / UI 상태 |
| [GrantListRow](../src/components/grants/GrantListRow/GrantListRow.tsx) | `GrantListRowProps` | grant, label, tone, deadline | props / UI 상태 |
| [GrantMonthCard](../src/components/grants/GrantMonthCard/GrantMonthCard.tsx) | `GrantMonthCardProps` | group | props / UI 상태 |
| [GrantPoster](../src/components/grants/GrantPoster/GrantPoster.tsx) | `GrantPosterProps` | grant, deadline, big? | props / UI 상태 |
| [GrantPosterArtwork](../src/components/grants/GrantPosterArtwork/GrantPosterArtwork.tsx) | 없음 | 없음 | props / UI 상태 |
| [GrantResults](../src/components/grants/GrantResults/GrantResults.tsx) | `GrantResultsProps` | grants, months, view | props / UI 상태 |
| [GrantsHeader](../src/components/grants/GrantsHeader/GrantsHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [GrantSortSelect](../src/components/grants/GrantSortSelect/GrantSortSelect.tsx) | `GrantSortSelectProps` | sort | props / UI 상태 |
| [GrantsPage](../src/components/grants/GrantsPage/GrantsPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [GrantSummary](../src/components/grants/GrantSummary/GrantSummary.tsx) | `GrantSummaryProps` | grant, deadline | props / UI 상태 |
| [GrantsView](../src/components/grants/GrantsView.tsx) | `GrantsViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ApplicationDialog](../src/components/layout/ApplicationDialog/ApplicationDialog.tsx) | `ApplicationDialogProps` | content | props / UI 상태 |
| [ApplicationFeedback](../src/components/layout/ApplicationFeedback/ApplicationFeedback.tsx) | `ApplicationFeedbackProps` | onCloseModal (콜백), onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ApplicationLoading](../src/components/layout/ApplicationLoading/ApplicationLoading.tsx) | 없음 | 없음 | props / UI 상태 |
| [ApplicationNavigation](../src/components/layout/ApplicationNavigation/ApplicationNavigation.tsx) | `ApplicationNavigationProps` | data?, loading?, error?, onRetry? (콜백), onNavigate (콜백), onOpenNotification (콜백), onLogout (콜백) | props / UI 상태 |
| [AppShell](../src/components/layout/AppShell/AppShell.tsx) | `AppShellProps` | navigation, children, viewport? | props / UI 상태 |
| [ConnectedApplicationFeedback](../src/components/layout/ConnectedApplicationFeedback/ConnectedApplicationFeedback.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [ConnectedApplicationNavigation](../src/components/layout/ConnectedApplicationNavigation/ConnectedApplicationNavigation.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [FoundyApplication](../src/components/layout/FoundyApplication/FoundyApplication.tsx) | `FoundyApplicationProps` | children | Page / Connected 어댑터 |
| [ComponentBoundary](../src/components/loading/ComponentBoundary/ComponentBoundary.tsx) | `ComponentBoundaryProps` | component, fallback?, data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [DataBoundary](../src/components/loading/DataBoundary/DataBoundary.tsx) | `DataBoundaryProps` | children (콜백), fallback, data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [DataContent](../src/components/loading/DataContent/DataContent.tsx) | `DataContentProps` | data, children (콜백) | props / UI 상태 |
| [DataError](../src/components/loading/DataError/DataError.tsx) | `DataErrorProps` | message?, onRetry? (콜백) | props / UI 상태 |
| [DataErrorBoundary](../src/components/loading/DataErrorBoundary/DataErrorBoundary.tsx) | `DataErrorBoundaryProps` | children, resetKey, onRetry? (콜백) | props / UI 상태 |
| [PageSkeleton](../src/components/loading/PageSkeleton/PageSkeleton.tsx) | `PageSkeletonProps` | page? | props / UI 상태 |
| [SectionSkeleton](../src/components/loading/SectionSkeleton/SectionSkeleton.tsx) | `SectionSkeletonProps` | variant?, rows?, label?, className? | props / UI 상태 |
| [Skeleton](../src/components/loading/Skeleton/Skeleton.tsx) | `SkeletonProps` | className? | props / UI 상태 |
| [LoginActions](../src/components/login/LoginActions/LoginActions.tsx) | 없음 | 없음 | props / UI 상태 |
| [LoginBrand](../src/components/login/LoginBrand/LoginBrand.tsx) | 없음 | 없음 | props / UI 상태 |
| [LoginCard](../src/components/login/LoginCard/LoginCard.tsx) | 없음 | 없음 | props / UI 상태 |
| [LoginView](../src/components/login/LoginView.tsx) | `LoginViewProps` | onEvent? (콜백) | props / UI 상태 |
| [PasswordLoginForm](../src/components/login/PasswordLoginForm/PasswordLoginForm.tsx) | 없음 | 없음 | props / UI 상태 |
| [SignupCard](../src/components/login/SignupCard/SignupCard.tsx) | 없음 | 없음 | props / UI 상태 |
| [SignupForm](../src/components/login/SignupForm/SignupForm.tsx) | 없음 | 없음 | props / UI 상태 |
| [SignupView](../src/components/login/SignupView/SignupView.tsx) | `SignupViewProps` | onEvent? (콜백) | props / UI 상태 |
| [SocialLoginButton](../src/components/login/SocialLoginButton/SocialLoginButton.tsx) | `SocialLoginButtonProps` | provider, label | props / UI 상태 |
| [SocialSignInDialog](../src/components/login/SocialSignInDialog/SocialSignInDialog.tsx) | `SocialSignInDialogProps` | provider, providerLabel | props / UI 상태 |
| [AccountCard](../src/components/mypage/AccountCard/AccountCard.tsx) | `AccountCardProps` | profile, providerLabel | props / UI 상태 |
| [AnalysisProgressDialog](../src/components/mypage/AnalysisProgressDialog/AnalysisProgressDialog.tsx) | `AnalysisProgressDialogProps` | steps, completed, changes | props / UI 상태 |
| [BusinessConditionsCard](../src/components/mypage/BusinessConditionsCard/BusinessConditionsCard.tsx) | `BusinessConditionsCardProps` | draft, fields, impacts | props / UI 상태 |
| [DataManagementCard](../src/components/mypage/DataManagementCard/DataManagementCard.tsx) | 없음 | 없음 | props / UI 상태 |
| [ImpactCard](../src/components/mypage/ImpactCard/ImpactCard.tsx) | `ImpactCardProps` | changes, affectedLabels, resetCards | props / UI 상태 |
| [ImpactHint](../src/components/mypage/ImpactHint/ImpactHint.tsx) | `ImpactHintProps` | labels | props / UI 상태 |
| [MypagePage](../src/components/mypage/MypagePage/MypagePage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [MypageView](../src/components/mypage/MypageView.tsx) | `MypageViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ProfileBooleanField](../src/components/mypage/ProfileBooleanField/ProfileBooleanField.tsx) | `ProfileBooleanFieldProps` | field, label, value, hints | props / UI 상태 |
| [ProfileField](../src/components/mypage/ProfileField/ProfileField.tsx) | `ProfileFieldProps` | label, hints, full?, children | props / UI 상태 |
| [ProfileHeader](../src/components/mypage/ProfileHeader/ProfileHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [ResetCardNotice](../src/components/mypage/ResetCardNotice/ResetCardNotice.tsx) | `ResetCardNoticeProps` | cards | props / UI 상태 |
| [StoreDetailsCard](../src/components/mypage/StoreDetailsCard/StoreDetailsCard.tsx) | `StoreDetailsCardProps` | draft, fields, impacts, regions | props / UI 상태 |
| [StoreResetDialog](../src/components/mypage/StoreResetDialog/StoreResetDialog.tsx) | 없음 | 없음 | props / UI 상태 |
| [AccountActions](../src/components/navigation/AccountActions/AccountActions.tsx) | `AccountActionsProps` | storeName, notifications, onOpenNotification (콜백), onOpenStore (콜백), onLogout (콜백) | props / UI 상태 |
| [Logo](../src/components/navigation/Logo/Logo.tsx) | `LogoProps` | onHome (콜백) | props / UI 상태 |
| [LogoutButton](../src/components/navigation/LogoutButton/LogoutButton.tsx) | `LogoutButtonProps` | onLogout (콜백) | props / UI 상태 |
| [Navbar](../src/components/navigation/Navbar/Navbar.tsx) | `NavbarProps` | onNavigate (콜백), onOpenNotification (콜백), onLogout (콜백), currentPage, storeName, notifications, destinations?, onboarded? | props / UI 상태 |
| [NavItem](../src/components/navigation/NavItem/NavItem.tsx) | `NavItemProps` | destination, active, onNavigate (콜백) | props / UI 상태 |
| [NavLinks](../src/components/navigation/NavLinks/NavLinks.tsx) | `NavLinksProps` | currentPage, onNavigate (콜백), className?, destinations? | props / UI 상태 |
| [NotificationButton](../src/components/navigation/NotificationButton/NotificationButton.tsx) | `NotificationButtonProps` | unread, open, panelId, buttonRef, onToggle (콜백), onKeyDown (콜백) | props / UI 상태 |
| [NotificationItem](../src/components/navigation/NotificationItem/NotificationItem.tsx) | `NotificationItemProps` | notification, onOpen (콜백) | props / UI 상태 |
| [NotificationMenu](../src/components/navigation/NotificationMenu/NotificationMenu.tsx) | `NotificationMenuProps` | notifications, onOpen (콜백) | props / UI 상태 |
| [NotificationPopover](../src/components/navigation/NotificationPopover/NotificationPopover.tsx) | `NotificationPopoverProps` | id, panelRef, unread, notifications, position, onOpen (콜백), onMouseEnter (콜백), onMouseLeave (콜백) | props / UI 상태 |
| [StoreIdentity](../src/components/navigation/StoreIdentity/StoreIdentity.tsx) | `StoreIdentityProps` | name, onOpen (콜백) | props / UI 상태 |
| [AnalysisStep](../src/components/onboarding/AnalysisStep/AnalysisStep.tsx) | `AnalysisStepProps` | storeName, steps, completed | props / UI 상태 |
| [BusinessQuestion](../src/components/onboarding/BusinessQuestion/BusinessQuestion.tsx) | `BusinessQuestionProps` | field, title, description, value | props / UI 상태 |
| [BusinessQuestionsStep](../src/components/onboarding/BusinessQuestionsStep/BusinessQuestionsStep.tsx) | `BusinessQuestionsStepProps` | store | props / UI 상태 |
| [DemoScenarioBanner](../src/components/onboarding/DemoScenarioBanner/DemoScenarioBanner.tsx) | 없음 | 없음 | props / UI 상태 |
| [OnboardingHeader](../src/components/onboarding/OnboardingHeader/OnboardingHeader.tsx) | `OnboardingHeaderProps` | returning, userName | props / UI 상태 |
| [OnboardingPage](../src/components/onboarding/OnboardingPage/OnboardingPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [OnboardingView](../src/components/onboarding/OnboardingView.tsx) | `OnboardingViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [StoreAddressFields](../src/components/onboarding/StoreAddressFields/StoreAddressFields.tsx) | `StoreAddressFieldsProps` | store | props / UI 상태 |
| [StoreIdentityFields](../src/components/onboarding/StoreIdentityFields/StoreIdentityFields.tsx) | `StoreIdentityFieldsProps` | store | props / UI 상태 |
| [StoreInformationForm](../src/components/onboarding/StoreInformationForm/StoreInformationForm.tsx) | `StoreInformationFormProps` | store | props / UI 상태 |
| [StoreInformationStep](../src/components/onboarding/StoreInformationStep/StoreInformationStep.tsx) | `StoreInformationStepProps` | store | props / UI 상태 |
| [StoreScheduleFields](../src/components/onboarding/StoreScheduleFields/StoreScheduleFields.tsx) | `StoreScheduleFieldsProps` | store | props / UI 상태 |
| [WizardProgress](../src/components/onboarding/WizardProgress/WizardProgress.tsx) | `WizardProgressProps` | step | props / UI 상태 |
| [WizardStep](../src/components/onboarding/WizardStep/WizardStep.tsx) | `WizardStepProps` | number, label, active | props / UI 상태 |
| [EvidenceDialog](../src/components/report/EvidenceDialog/EvidenceDialog.tsx) | `EvidenceDialogProps` | items, date | props / UI 상태 |
| [EvidenceItem](../src/components/report/EvidenceItem/EvidenceItem.tsx) | `EvidenceItemProps` | item, date | props / UI 상태 |
| [LockedReport](../src/components/report/LockedReport/LockedReport.tsx) | 없음 | 없음 | props / UI 상태 |
| [NextStepItem](../src/components/report/NextStepItem/NextStepItem.tsx) | `NextStepItemProps` | step | props / UI 상태 |
| [OptionCard](../src/components/report/OptionCard/OptionCard.tsx) | `OptionCardProps` | cardId, option, recommended | props / UI 상태 |
| [OptionConfirmDialog](../src/components/report/OptionConfirmDialog/OptionConfirmDialog.tsx) | `OptionConfirmDialogProps` | cardId, optionId, label, summary, changes, recommended, reason?, meta | props / UI 상태 |
| [ReportCard](../src/components/report/ReportCard/ReportCard.tsx) | `ReportCardProps` | model | props / UI 상태 |
| [ReportCardActions](../src/components/report/ReportCardActions/ReportCardActions.tsx) | `ReportCardActionsProps` | cardId | props / UI 상태 |
| [ReportCardSummary](../src/components/report/ReportCardSummary/ReportCardSummary.tsx) | `ReportCardSummaryProps` | card, state, verdict, followUpPending, status | props / UI 상태 |
| [ReportFilters](../src/components/report/ReportFilters/ReportFilters.tsx) | `ReportFiltersProps` | selected | props / UI 상태 |
| [ReportFollowUp](../src/components/report/ReportFollowUp/ReportFollowUp.tsx) | `ReportFollowUpProps` | model | props / UI 상태 |
| [ReportHeader](../src/components/report/ReportHeader/ReportHeader.tsx) | `ReportHeaderProps` | locked | props / UI 상태 |
| [ReportNextSteps](../src/components/report/ReportNextSteps/ReportNextSteps.tsx) | `ReportNextStepsProps` | model | props / UI 상태 |
| [ReportOptions](../src/components/report/ReportOptions/ReportOptions.tsx) | `ReportOptionsProps` | card, state, verdict | props / UI 상태 |
| [ReportPage](../src/components/report/ReportPage/ReportPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [ReportSummary](../src/components/report/ReportSummary/ReportSummary.tsx) | `ReportSummaryProps` | counts, firstByVerdict | props / UI 상태 |
| [ReportView](../src/components/report/ReportView.tsx) | `ReportViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [VerdictBadge](../src/components/report/VerdictBadge/VerdictBadge.tsx) | `VerdictBadgeProps` | verdict | props / UI 상태 |
| [CompetitionCard](../src/components/sites/CompetitionCard/CompetitionCard.tsx) | `CompetitionCardProps` | analysis | props / UI 상태 |
| [FieldChecklistCard](../src/components/sites/FieldChecklistCard/FieldChecklistCard.tsx) | `FieldChecklistCardProps` | onOpenReport? (콜백) | props / UI 상태 |
| [LocationPickDialog](../src/components/sites/LocationPickDialog/LocationPickDialog.tsx) | `LocationPickDialogProps` | areaId | props / UI 상태 |
| [MarketAnalysisPanel](../src/components/sites/MarketAnalysisPanel/MarketAnalysisPanel.tsx) | `MarketAnalysisPanelProps` | open, onClose (콜백), center, radius, category, onCategoryChange (콜백), summary, population, shops, planning | props / UI 상태 |
| [MarketBar](../src/components/sites/MarketBar/MarketBar.tsx) | `MarketBarProps` | label, value, percent | props / UI 상태 |
| [MarketCategoryFilter](../src/components/sites/MarketCategoryFilter/MarketCategoryFilter.tsx) | `MarketCategoryFilterProps` | value, onChange (콜백) | props / UI 상태 |
| [MarketEmptyState](../src/components/sites/MarketEmptyState/MarketEmptyState.tsx) | 없음 | 없음 | props / UI 상태 |
| [MarketMetric](../src/components/sites/MarketMetric/MarketMetric.tsx) | `MarketMetricProps` | label, children, unavailable? | props / UI 상태 |
| [MarketPanelCard](../src/components/sites/MarketPanelCard/MarketPanelCard.tsx) | `MarketPanelCardProps` | title, description?, children | props / UI 상태 |
| [MarketPanelHeader](../src/components/sites/MarketPanelHeader/MarketPanelHeader.tsx) | `MarketPanelHeaderProps` | center, radius, onClose (콜백) | props / UI 상태 |
| [MarketPanelTabs](../src/components/sites/MarketPanelTabs/MarketPanelTabs.tsx) | `MarketPanelTabsProps` | value, onChange (콜백) | props / UI 상태 |
| [MarketSummaryCard](../src/components/sites/MarketSummaryCard/MarketSummaryCard.tsx) | `MarketSummaryCardProps` | analysis | props / UI 상태 |
| [NearbyShopsCard](../src/components/sites/NearbyShopsCard/NearbyShopsCard.tsx) | `NearbyShopsCardProps` | shops, selectedShop?, onSelect (콜백) | props / UI 상태 |
| [PopulationBreakdownCard](../src/components/sites/PopulationBreakdownCard/PopulationBreakdownCard.tsx) | `PopulationBreakdownCardProps` | title, description, rows, chart | props / UI 상태 |
| [PopulationDataNote](../src/components/sites/PopulationDataNote/PopulationDataNote.tsx) | `PopulationDataNoteProps` | date | props / UI 상태 |
| [PopulationHourlyCard](../src/components/sites/PopulationHourlyCard/PopulationHourlyCard.tsx) | `PopulationHourlyCardProps` | points, hour, onHourChange (콜백) | props / UI 상태 |
| [PopulationReport](../src/components/sites/PopulationReport/PopulationReport.tsx) | `PopulationReportProps` | data?, loading?, error?, retry? (콜백), hour, onHourChange (콜백) | props / UI 상태 |
| [PopulationSummaryCard](../src/components/sites/PopulationSummaryCard/PopulationSummaryCard.tsx) | `PopulationSummaryCardProps` | data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [PriceComparison](../src/components/sites/PriceComparison/PriceComparison.tsx) | `PriceComparisonProps` | range, position, price, format (콜백) | props / UI 상태 |
| [PricePositionCard](../src/components/sites/PricePositionCard/PricePositionCard.tsx) | `PricePositionCardProps` | price, range, position, format? (콜백), onPriceChange? (콜백) | props / UI 상태 |
| [SelectedShop](../src/components/sites/SelectedShop/SelectedShop.tsx) | `SelectedShopProps` | shop? | props / UI 상태 |
| [ShopListItem](../src/components/sites/ShopListItem/ShopListItem.tsx) | `ShopListItemProps` | shop, selected, onSelect (콜백) | props / UI 상태 |
| [SitesPage](../src/components/sites/SitesPage/SitesPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [SitesView](../src/components/sites/SitesView.tsx) | `SitesViewProps` | data?, loading?, error?, onRetry? (콜백), appKey?, footTrafficData?, footTrafficSource?, footTrafficLoading?, footTrafficError?, onFootTrafficRetry? (콜백), populationData?, populationSource?, populationInsights?, onAnalysisChange? (콜백), onPriceChange? (콜백), onOpenReport? (콜백) | props / UI 상태 |
| [SitesWorkspace](../src/components/sites/SitesWorkspace/SitesWorkspace.tsx) | `SitesWorkspaceProps` | data, appKey?, footTrafficData?, footTrafficSource?, footTrafficLoading?, footTrafficError?, onFootTrafficRetry? (콜백), populationData?, populationSource?, populationInsights?, onAnalysisChange? (콜백), onPriceChange? (콜백), onOpenReport? (콜백) | props / UI 상태 |
| [StrategyCard](../src/components/sites/StrategyCard/StrategyCard.tsx) | 없음 | 없음 | props / UI 상태 |
| [StrategyRow](../src/components/sites/StrategyRow/StrategyRow.tsx) | `StrategyRowProps` | text, source | props / UI 상태 |
| [Input](../src/components/ui/Input/Input.tsx) | `InputProps` | React HTML 속성 | props / UI 상태 |
| [Select](../src/components/ui/Select/Select.tsx) | `SelectProps` | React HTML 속성 | props / UI 상태 |
| [Textarea](../src/components/ui/Textarea/Textarea.tsx) | `TextareaProps` | React HTML 속성 | props / UI 상태 |
| [Element](../src/components/view/Element/Element.tsx) | `ElementProps` | React HTML 속성 | props / UI 상태 |
| [EventBoundary](../src/components/view/EventBoundary/EventBoundary.tsx) | `EventBoundaryProps` | children, onEvent? (콜백) | props / UI 상태 |
| [FeatureView](../src/components/view/FeatureView/FeatureView.tsx) | `FeatureViewProps` | page, children, onEvent? (콜백) | props / UI 상태 |
