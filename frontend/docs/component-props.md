# 컴포넌트 Props 목록

`npm run docs:props`로 실제 TypeScript 선언에서 생성합니다. 데이터와 이벤트 콜백은 별도 필드입니다.
페이지 데이터 계약과 Promise/스켈레톤 사용법은 [API 연결 가이드](./api-props-and-loading.md)를 참고하세요.

총 271개 컴포넌트. 상세 필드 타입: [component-props.json](./component-props.json).

| 컴포넌트 | 공개 Props 타입 | 입력 필드 | 상태 연결 |
| --- | --- | --- | --- |
| [DonutChart](../src/components/charts/DonutChart/DonutChart.tsx) | `DonutChartProps` | title, rows, unit?, centerLabel?, formatValue? (콜백), showPercent? | props / UI 상태 |
| [HorizontalBarChart](../src/components/charts/HorizontalBarChart/HorizontalBarChart.tsx) | `HorizontalBarChartProps` | title, rows, unit?, formatValue? (콜백), maxValue? | props / UI 상태 |
| [HourlyPopulationChart](../src/components/charts/HourlyPopulationChart/HourlyPopulationChart.tsx) | `HourlyPopulationChartProps` | points, selectedHour, onSelectHour (콜백) | props / UI 상태 |
| [RangeChart](../src/components/charts/RangeChart/RangeChart.tsx) | `RangeChartProps` | title, min, median, max, value?, format? (콜백) | props / UI 상태 |
| [CallPreparation](../src/components/chat/CallPreparation/CallPreparation.tsx) | `CallPreparationProps` | cardId, guide, memo | props / UI 상태 |
| [ChatActionCard](../src/components/chat/ChatActionCard/ChatActionCard.tsx) | `ChatActionCardProps` | action, messageIndex, actionIndex, typeLabel? | props / UI 상태 |
| [ChatComposer](../src/components/chat/ChatComposer/ChatComposer.tsx) | `ChatComposerProps` | draft, busy | props / UI 상태 |
| [ChatConversation](../src/components/chat/ChatConversation/ChatConversation.tsx) | `ChatConversationProps` | storeName, undecided, messages, busy, request, cards, contacts, actionLabels, callGuides, memo | props / UI 상태 |
| [ChatHeader](../src/components/chat/ChatHeader/ChatHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [ChatLauncher](../src/components/chat/ChatLauncher/ChatLauncher.tsx) | `ChatLauncherProps` | open | props / UI 상태 |
| [ChatMessage](../src/components/chat/ChatMessage/ChatMessage.tsx) | `ChatMessageProps` | message, index, last, busy?, cards, contacts, actionLabels, callGuides, memo | props / UI 상태 |
| [ChatPanel](../src/components/chat/ChatPanel/ChatPanel.tsx) | `ChatPanelProps` | data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ChatPanelContent](../src/components/chat/ChatPanelContent/ChatPanelContent.tsx) | `ChatPanelContentProps` | data | props / UI 상태 |
| [ChatProcessing](../src/components/chat/ChatProcessing/ChatProcessing.tsx) | `ChatProcessingProps` | processing, actions?, messageIndex? | props / UI 상태 |
| [ChatProcessingStep](../src/components/chat/ChatProcessingStep/ChatProcessingStep.tsx) | `ChatProcessingStepProps` | label, detail?, state, last | props / UI 상태 |
| [ChatSubmitButton](../src/components/chat/ChatSubmitButton/ChatSubmitButton.tsx) | `ChatSubmitButtonProps` | busy, disabled | props / UI 상태 |
| [ChatSupportIcon](../src/components/chat/ChatSupportIcon/ChatSupportIcon.tsx) | `ChatSupportIconProps` | className? | props / UI 상태 |
| [ChatWelcome](../src/components/chat/ChatWelcome/ChatWelcome.tsx) | `ChatWelcomeProps` | storeName, undecided | props / UI 상태 |
| [ChatWidget](../src/components/chat/ChatWidget/ChatWidget.tsx) | `ChatWidgetProps` | open, onboarded, onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ConnectedChatWidget](../src/components/chat/ConnectedChatWidget/ConnectedChatWidget.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [FavoriteQuestions](../src/components/chat/FavoriteQuestions/FavoriteQuestions.tsx) | `FavoriteQuestionsProps` | busy? | props / UI 상태 |
| [MessageCitations](../src/components/chat/MessageCitations/MessageCitations.tsx) | `MessageCitationsProps` | citations | props / UI 상태 |
| [MessageText](../src/components/chat/MessageText/MessageText.tsx) | `MessageTextProps` | text | props / UI 상태 |
| [PinnedQuestion](../src/components/chat/PinnedQuestion/PinnedQuestion.tsx) | `PinnedQuestionProps` | title, verdict, verdictLabel | props / UI 상태 |
| [QuestionSuggestions](../src/components/chat/QuestionSuggestions/QuestionSuggestions.tsx) | `QuestionSuggestionsProps` | questions, busy? | props / UI 상태 |
| [CalendarAgendaCard](../src/components/checklist/CalendarAgendaCard/CalendarAgendaCard.tsx) | `CalendarAgendaCardProps` | selected, events, colors | props / UI 상태 |
| [CalendarDayCell](../src/components/checklist/CalendarDayCell/CalendarDayCell.tsx) | `CalendarDayCellProps` | day, colors, pickerButton? | props / UI 상태 |
| [CalendarEventRow](../src/components/checklist/CalendarEventRow/CalendarEventRow.tsx) | `CalendarEventRowProps` | event, color | props / UI 상태 |
| [CalendarLegend](../src/components/checklist/CalendarLegend/CalendarLegend.tsx) | `CalendarLegendProps` | colors | props / UI 상태 |
| [CalendarMonthCard](../src/components/checklist/CalendarMonthCard/CalendarMonthCard.tsx) | `CalendarMonthCardProps` | year, month, days, colors | props / UI 상태 |
| [ChecklistHeader](../src/components/checklist/ChecklistHeader/ChecklistHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [ChecklistPage](../src/components/checklist/ChecklistPage/ChecklistPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [ChecklistProgress](../src/components/checklist/ChecklistProgress/ChecklistProgress.tsx) | `ChecklistProgressProps` | opening, done, total | props / UI 상태 |
| [ChecklistSkeleton](../src/components/checklist/ChecklistSkeleton/ChecklistSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [ChecklistTaskFilter](../src/components/checklist/ChecklistTaskFilter/ChecklistTaskFilter.tsx) | `ChecklistTaskFilterProps` | value, onChange (콜백) | props / UI 상태 |
| [ChecklistTaskList](../src/components/checklist/ChecklistTaskList/ChecklistTaskList.tsx) | `ChecklistTaskListProps` | groups, filter | props / UI 상태 |
| [ChecklistView](../src/components/checklist/ChecklistView.tsx) | `ChecklistViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ChecklistViewTabs](../src/components/checklist/ChecklistViewTabs/ChecklistViewTabs.tsx) | `ChecklistViewTabsProps` | view | props / UI 상태 |
| [OpeningDateDialog](../src/components/checklist/OpeningDateDialog/OpeningDateDialog.tsx) | `OpeningDateDialogProps` | opening | props / UI 상태 |
| [TaskDeadline](../src/components/checklist/TaskDeadline/TaskDeadline.tsx) | `TaskDeadlineProps` | due, deadline, done | props / UI 상태 |
| [TaskGroupCard](../src/components/checklist/TaskGroupCard/TaskGroupCard.tsx) | `TaskGroupCardProps` | group, visibleTasks? | props / UI 상태 |
| [TaskMetadata](../src/components/checklist/TaskMetadata/TaskMetadata.tsx) | `TaskMetadataProps` | task | props / UI 상태 |
| [TaskRow](../src/components/checklist/TaskRow/TaskRow.tsx) | `TaskRowProps` | contextLabel?, task, deadline, documentCount | props / UI 상태 |
| [AnalysisStatusItem](../src/components/common/AnalysisStatusItem/AnalysisStatusItem.tsx) | `AnalysisStatusItemProps` | label, index, complete, running, completeLabel? | props / UI 상태 |
| [MetricCard](../src/components/common/MetricCard/MetricCard.tsx) | `MetricCardProps` | label, value, caption? | props / UI 상태 |
| [PageHeader](../src/components/common/PageHeader/PageHeader.tsx) | `PageHeaderProps` | eyebrow, title, description, notice?, actions?, actionsLayout?, breadcrumbLabel? | props / UI 상태 |
| [ActionItem](../src/components/dashboard/ActionItem/ActionItem.tsx) | `ActionItemProps` | item | props / UI 상태 |
| [DashboardBentoGrid](../src/components/dashboard/DashboardBentoGrid/DashboardBentoGrid.tsx) | `DashboardBentoGridProps` | dashboard, population? | props / UI 상태 |
| [DashboardBentoSkeleton](../src/components/dashboard/DashboardBentoSkeleton/DashboardBentoSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [DashboardCard](../src/components/dashboard/DashboardCard/DashboardCard.tsx) | `DashboardCardProps` | children, className?, label? | props / UI 상태 |
| [DashboardCardLink](../src/components/dashboard/DashboardCardLink/DashboardCardLink.tsx) | `DashboardCardLinkProps` | page, children, focusId?, className? | props / UI 상태 |
| [DashboardGreeting](../src/components/dashboard/DashboardGreeting/DashboardGreeting.tsx) | `DashboardGreetingProps` | copy, paused? | props / UI 상태 |
| [DashboardHeader](../src/components/dashboard/DashboardHeader/DashboardHeader.tsx) | `DashboardHeaderProps` | store, name, days, undecided | props / UI 상태 |
| [DashboardHeaderActions](../src/components/dashboard/DashboardHeaderActions/DashboardHeaderActions.tsx) | `DashboardHeaderActionsProps` | undecided | props / UI 상태 |
| [DashboardHeaderDetails](../src/components/dashboard/DashboardHeaderDetails/DashboardHeaderDetails.tsx) | `DashboardHeaderDetailsProps` | store, undecided, dateLabel | props / UI 상태 |
| [DashboardHeaderSkeleton](../src/components/dashboard/DashboardHeaderSkeleton/DashboardHeaderSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [DashboardMetrics](../src/components/dashboard/DashboardMetrics/DashboardMetrics.tsx) | `DashboardMetricsProps` | undecided, decisions, tasks, unread | props / UI 상태 |
| [DashboardPage](../src/components/dashboard/DashboardPage/DashboardPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [DashboardSectionDivider](../src/components/dashboard/DashboardSectionDivider/DashboardSectionDivider.tsx) | `DashboardSectionDividerProps` | orientation?, className? | props / UI 상태 |
| [DashboardSectionHeader](../src/components/dashboard/DashboardSectionHeader/DashboardSectionHeader.tsx) | `DashboardSectionHeaderProps` | title, description?, action? | props / UI 상태 |
| [DashboardSkeleton](../src/components/dashboard/DashboardSkeleton/DashboardSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [DashboardTaskRow](../src/components/dashboard/DashboardTaskRow/DashboardTaskRow.tsx) | `DashboardTaskRowProps` | task, asOf? | props / UI 상태 |
| [DashboardView](../src/components/dashboard/DashboardView.tsx) | `DashboardViewProps` | population?, onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [DecisionItem](../src/components/dashboard/DecisionItem/DecisionItem.tsx) | `DecisionItemProps` | card | props / UI 상태 |
| [DecisionList](../src/components/dashboard/DecisionList/DecisionList.tsx) | `DecisionListProps` | cards, undecided | props / UI 상태 |
| [GreetingPlaybackButton](../src/components/dashboard/GreetingPlaybackButton/GreetingPlaybackButton.tsx) | `GreetingPlaybackButtonProps` | paused, onPauseChange (콜백) | props / UI 상태 |
| [OpeningCountdown](../src/components/dashboard/OpeningCountdown/OpeningCountdown.tsx) | `OpeningCountdownProps` | dayLabel, label | props / UI 상태 |
| [OpeningScheduleCard](../src/components/dashboard/OpeningScheduleCard/OpeningScheduleCard.tsx) | `OpeningScheduleCardProps` | opening, days, className? | props / UI 상태 |
| [OpeningWeekCalendar](../src/components/dashboard/OpeningWeekCalendar/OpeningWeekCalendar.tsx) | `OpeningWeekCalendarProps` | opening, className? | props / UI 상태 |
| [OpeningWeekCalendarDay](../src/components/dashboard/OpeningWeekCalendarDay/OpeningWeekCalendarDay.tsx) | `OpeningWeekCalendarDayProps` | day | props / UI 상태 |
| [PopulationChartTooltip](../src/components/dashboard/PopulationChartTooltip/PopulationChartTooltip.tsx) | `PopulationChartTooltipProps` | id, point, leftPercent, barHeight | props / UI 상태 |
| [PopulationPreviewChart](../src/components/dashboard/PopulationPreviewChart/PopulationPreviewChart.tsx) | `PopulationPreviewChartProps` | points, selectedHour, onSelectHour (콜백) | props / UI 상태 |
| [PopulationSnapshotCard](../src/components/dashboard/PopulationSnapshotCard/PopulationSnapshotCard.tsx) | `PopulationSnapshotCardProps` | data?, className? | props / UI 상태 |
| [PreparationProgressCard](../src/components/dashboard/PreparationProgressCard/PreparationProgressCard.tsx) | `PreparationProgressCardProps` | count, stages?, className? | props / UI 상태 |
| [PreparationRing](../src/components/dashboard/PreparationRing/PreparationRing.tsx) | `PreparationRingProps` | done, total, stages? | props / UI 상태 |
| [PreparationRingArc](../src/components/dashboard/PreparationRingArc/PreparationRingArc.tsx) | `PreparationRingArcProps` | length, offset?, color, opacity?, roundCaps? | props / UI 상태 |
| [PreparationRingTransition](../src/components/dashboard/PreparationRingTransition/PreparationRingTransition.tsx) | `PreparationRingTransitionProps` | offset, length, from, to | props / UI 상태 |
| [PreparationStages](../src/components/dashboard/PreparationStages/PreparationStages.tsx) | `PreparationStagesProps` | stages, total? | props / UI 상태 |
| [PriorityDecisionCard](../src/components/dashboard/PriorityDecisionCard/PriorityDecisionCard.tsx) | `PriorityDecisionCardProps` | cards, undecided, counts?, sourceLabel?, className? | props / UI 상태 |
| [PriorityDecisionContent](../src/components/dashboard/PriorityDecisionContent/PriorityDecisionContent.tsx) | `PriorityDecisionContentProps` | card | props / UI 상태 |
| [ReportActionCallout](../src/components/dashboard/ReportActionCallout/ReportActionCallout.tsx) | `ReportActionCalloutProps` | action | props / UI 상태 |
| [ReportStatusStrip](../src/components/dashboard/ReportStatusStrip/ReportStatusStrip.tsx) | `ReportStatusStripProps` | counts, sourceLabel? | props / UI 상태 |
| [TaskItem](../src/components/dashboard/TaskItem/TaskItem.tsx) | `TaskItemProps` | task | props / UI 상태 |
| [TaskList](../src/components/dashboard/TaskList/TaskList.tsx) | `TaskListProps` | actions, tasks | props / UI 상태 |
| [UpcomingTasksCard](../src/components/dashboard/UpcomingTasksCard/UpcomingTasksCard.tsx) | `UpcomingTasksCardProps` | tasks, actions, asOf?, className? | props / UI 상태 |
| [DocRow](../src/components/docs/DocRow/DocRow.tsx) | `DocRowProps` | document, compact?, expanded?, onExpandedChange? (콜백) | props / UI 상태 |
| [DocsDirectory](../src/components/docs/DocsDirectory/DocsDirectory.tsx) | `DocsDirectoryProps` | rows | props / UI 상태 |
| [DocsHeader](../src/components/docs/DocsHeader/DocsHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [DocSiteLinks](../src/components/docs/DocSiteLinks/DocSiteLinks.tsx) | `DocSiteLinksProps` | sites | props / UI 상태 |
| [DocsPage](../src/components/docs/DocsPage/DocsPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [DocsSkeleton](../src/components/docs/DocsSkeleton/DocsSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [DocsSummary](../src/components/docs/DocsSummary/DocsSummary.tsx) | `DocsSummaryProps` | summaryBasis?, total, finished, remaining | props / UI 상태 |
| [DocsView](../src/components/docs/DocsView/DocsView.tsx) | `DocsViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [DocTaskCard](../src/components/docs/DocTaskCard/DocTaskCard.tsx) | `DocTaskCardProps` | row, expandedDocumentId?, onExpandedDocumentChange? (콜백) | props / UI 상태 |
| [DocumentStatusSelect](../src/components/docs/DocumentStatusSelect/DocumentStatusSelect.tsx) | `DocumentStatusSelectProps` | id, name, status | props / UI 상태 |
| [Modal](../src/components/feedback/Modal/Modal.tsx) | `ModalProps` | title, children, actions?, onClose (콜백), variant?, getReturnFocusTarget? (콜백) | props / UI 상태 |
| [Toast](../src/components/feedback/Toast/Toast.tsx) | `ToastProps` | message, notificationId? | props / UI 상태 |
| [FootTrafficMap](../src/components/foot-traffic/FootTrafficMap/FootTrafficMap.tsx) | `FootTrafficMapProps` | appKey?, dataSource?, dataset?, loading?, error?, onRetry? (콜백), center, onCenterChange (콜백), radius, onRadiusChange (콜백), shops, selectedShopId, onSelectShop (콜백), address?, onNearbyAvailabilityChange? (콜백), settingsOpen, onSettingsOpenChange (콜백), hour, lastHour, onHourChange (콜백) | props / UI 상태 |
| [FootTrafficMapSkeleton](../src/components/foot-traffic/FootTrafficMapSkeleton/FootTrafficMapSkeleton.tsx) | `FootTrafficMapSkeletonProps` | canvasOnly? | props / UI 상태 |
| [MapAvailability](../src/components/foot-traffic/MapAvailability/MapAvailability.tsx) | `MapAvailabilityProps` | state | props / UI 상태 |
| [MapCanvas](../src/components/foot-traffic/MapCanvas/MapCanvas.tsx) | `MapCanvasProps` | appKey, center, radius, level, lines, cells, cuts, label, hour, shops, selectedShopId, address?, onNearbyAvailabilityChange? (콜백), onSelectShop (콜백), onCenterChange (콜백), onLevelChange (콜백), onRegionChange (콜백), onAddressStatusChange (콜백) | props / UI 상태 |
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
| [GrantBadge](../src/components/grants/GrantBadge/GrantBadge.tsx) | `GrantBadgeProps` | label, prefix?, tone? | props / UI 상태 |
| [GrantCard](../src/components/grants/GrantCard/GrantCard.tsx) | `GrantCardProps` | grant, label, tone, deadline | props / UI 상태 |
| [GrantCardActions](../src/components/grants/GrantCardActions/GrantCardActions.tsx) | `GrantCardActionsProps` | id, title? | props / UI 상태 |
| [GrantConditionQuote](../src/components/grants/GrantConditionQuote/GrantConditionQuote.tsx) | `GrantConditionQuoteProps` | condition | props / UI 상태 |
| [GrantConditions](../src/components/grants/GrantConditions/GrantConditions.tsx) | `GrantConditionsProps` | checks | props / UI 상태 |
| [GrantDeadline](../src/components/grants/GrantDeadline/GrantDeadline.tsx) | `GrantDeadlineProps` | date, label?, applicationPeriod? | props / UI 상태 |
| [GrantDeadlineRow](../src/components/grants/GrantDeadlineRow/GrantDeadlineRow.tsx) | `GrantDeadlineRowProps` | grant, label, tone, deadline | props / UI 상태 |
| [GrantDetails](../src/components/grants/GrantDetails/GrantDetails.tsx) | `GrantDetailsProps` | grant, deadline, result | props / UI 상태 |
| [GrantDetailSummary](../src/components/grants/GrantDetailSummary/GrantDetailSummary.tsx) | `GrantDetailSummaryProps` | grant, deadline?, result | props / UI 상태 |
| [GrantEligibility](../src/components/grants/GrantEligibility/GrantEligibility.tsx) | `GrantEligibilityProps` | label, tone, organization?, deadline? | props / UI 상태 |
| [GrantFiltersBar](../src/components/grants/GrantFiltersBar/GrantFiltersBar.tsx) | `GrantFiltersBarProps` | filters, categories, children? | props / UI 상태 |
| [GrantFilterTabs](../src/components/grants/GrantFilterTabs/GrantFilterTabs.tsx) | `GrantFilterTabsProps` | options, filter, selected, style? | props / UI 상태 |
| [GrantListRow](../src/components/grants/GrantListRow/GrantListRow.tsx) | `GrantListRowProps` | grant, label, tone, deadline | props / UI 상태 |
| [GrantMonthCard](../src/components/grants/GrantMonthCard/GrantMonthCard.tsx) | `GrantMonthCardProps` | group | props / UI 상태 |
| [GrantNextDeadline](../src/components/grants/GrantNextDeadline/GrantNextDeadline.tsx) | `GrantNextDeadlineProps` | item | props / UI 상태 |
| [GrantPoster](../src/components/grants/GrantPoster/GrantPoster.tsx) | `GrantPosterProps` | grant, variant?, big? | props / UI 상태 |
| [GrantPosterArtwork](../src/components/grants/GrantPosterArtwork/GrantPosterArtwork.tsx) | `GrantPosterArtworkProps` | motif? | props / UI 상태 |
| [GrantRefreshControl](../src/components/grants/GrantRefreshControl/GrantRefreshControl.tsx) | `GrantRefreshControlProps` | refreshing, onRefresh (콜백) | props / UI 상태 |
| [GrantResults](../src/components/grants/GrantResults/GrantResults.tsx) | `GrantResultsProps` | grants, status? | props / UI 상태 |
| [GrantsHeader](../src/components/grants/GrantsHeader/GrantsHeader.tsx) | `GrantsHeaderProps` | sourceLabel?, nextDeadline? | props / UI 상태 |
| [GrantsPage](../src/components/grants/GrantsPage/GrantsPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [GrantsSkeleton](../src/components/grants/GrantsSkeleton/GrantsSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [GrantStatusFilter](../src/components/grants/GrantStatusFilter/GrantStatusFilter.tsx) | `GrantStatusFilterProps` | selected, counts? | props / UI 상태 |
| [GrantSummary](../src/components/grants/GrantSummary/GrantSummary.tsx) | `GrantSummaryProps` | grant | props / UI 상태 |
| [GrantsView](../src/components/grants/GrantsView.tsx) | `GrantsViewProps` | onRefresh? (콜백), refreshing?, refreshError?, onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ApplicationDialog](../src/components/layout/ApplicationDialog/ApplicationDialog.tsx) | `ApplicationDialogProps` | content | props / UI 상태 |
| [ApplicationFeedback](../src/components/layout/ApplicationFeedback/ApplicationFeedback.tsx) | `ApplicationFeedbackProps` | onCloseModal (콜백), onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [ApplicationLoading](../src/components/layout/ApplicationLoading/ApplicationLoading.tsx) | `ApplicationLoadingProps` | withinShell? | props / UI 상태 |
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
| [PageSkeleton](../src/components/loading/PageSkeleton/PageSkeleton.tsx) | `PageSkeletonProps` | page | props / UI 상태 |
| [SectionSkeleton](../src/components/loading/SectionSkeleton/SectionSkeleton.tsx) | `SectionSkeletonProps` | variant?, rows?, label?, className?, appearance? | props / UI 상태 |
| [Skeleton](../src/components/loading/Skeleton/Skeleton.tsx) | `SkeletonProps` | className? | props / UI 상태 |
| [LoginArtwork](../src/components/login/LoginArtwork/LoginArtwork.tsx) | 없음 | 없음 | props / UI 상태 |
| [LoginBrand](../src/components/login/LoginBrand/LoginBrand.tsx) | 없음 | 없음 | props / UI 상태 |
| [LoginField](../src/components/login/LoginField/LoginField.tsx) | `LoginFieldProps` | id, label, error?, trailingAction?, list?, form?, multiple?, onSelect? (콜백), dir?, nonce?, title?, lang?, max?, min?, name?, type?, accept?, alt?, autoComplete?, capture?, checked?, disabled?, formAction?, formEncType?, formMethod?, formNoValidate?, formTarget?, height?, maxLength?, minLength?, pattern?, placeholder?, readOnly?, required?, size?, src?, step?, value?, width?, onChange? (콜백), defaultChecked?, defaultValue?, suppressContentEditableWarning?, suppressHydrationWarning?, accessKey?, autoCapitalize?, autoFocus?, className?, contentEditable?, contextMenu?, draggable?, enterKeyHint?, hidden?, slot?, spellCheck?, style?, tabIndex?, translate?, radioGroup?, role?, about?, content?, datatype?, inlist?, prefix?, property?, rel?, resource?, rev?, typeof?, vocab?, autoCorrect?, autoSave?, color?, itemProp?, itemScope?, itemType?, itemID?, itemRef?, results?, security?, unselectable?, popover?, popoverTargetAction?, popoverTarget?, inert?, inputMode?, is?, exportparts?, part?, tw?, aria-activedescendant?, aria-atomic?, aria-autocomplete?, aria-braillelabel?, aria-brailleroledescription?, aria-busy?, aria-checked?, aria-colcount?, aria-colindex?, aria-colindextext?, aria-colspan?, aria-controls?, aria-current?, aria-describedby?, aria-description?, aria-details?, aria-disabled?, aria-dropeffect?, aria-errormessage?, aria-expanded?, aria-flowto?, aria-grabbed?, aria-haspopup?, aria-hidden?, aria-invalid?, aria-keyshortcuts?, aria-label?, aria-labelledby?, aria-level?, aria-live?, aria-modal?, aria-multiline?, aria-multiselectable?, aria-orientation?, aria-owns?, aria-placeholder?, aria-posinset?, aria-pressed?, aria-readonly?, aria-relevant?, aria-required?, aria-roledescription?, aria-rowcount?, aria-rowindex?, aria-rowindextext?, aria-rowspan?, aria-selected?, aria-setsize?, aria-sort?, aria-valuemax?, aria-valuemin?, aria-valuenow?, aria-valuetext?, children?, dangerouslySetInnerHTML?, onCopy? (콜백), onCopyCapture? (콜백), onCut? (콜백), onCutCapture? (콜백), onPaste? (콜백), onPasteCapture? (콜백), onCompositionEnd? (콜백), onCompositionEndCapture? (콜백), onCompositionStart? (콜백), onCompositionStartCapture? (콜백), onCompositionUpdate? (콜백), onCompositionUpdateCapture? (콜백), onFocus? (콜백), onFocusCapture? (콜백), onBlur? (콜백), onBlurCapture? (콜백), onChangeCapture? (콜백), onBeforeInput? (콜백), onBeforeInputCapture? (콜백), onInput? (콜백), onInputCapture? (콜백), onReset? (콜백), onResetCapture? (콜백), onSubmit? (콜백), onSubmitCapture? (콜백), onInvalid? (콜백), onInvalidCapture? (콜백), onLoad? (콜백), onLoadCapture? (콜백), onError? (콜백), onErrorCapture? (콜백), onKeyDown? (콜백), onKeyDownCapture? (콜백), onKeyPress? (콜백), onKeyPressCapture? (콜백), onKeyUp? (콜백), onKeyUpCapture? (콜백), onAbort? (콜백), onAbortCapture? (콜백), onCanPlay? (콜백), onCanPlayCapture? (콜백), onCanPlayThrough? (콜백), onCanPlayThroughCapture? (콜백), onDurationChange? (콜백), onDurationChangeCapture? (콜백), onEmptied? (콜백), onEmptiedCapture? (콜백), onEncrypted? (콜백), onEncryptedCapture? (콜백), onEnded? (콜백), onEndedCapture? (콜백), onLoadedData? (콜백), onLoadedDataCapture? (콜백), onLoadedMetadata? (콜백), onLoadedMetadataCapture? (콜백), onLoadStart? (콜백), onLoadStartCapture? (콜백), onPause? (콜백), onPauseCapture? (콜백), onPlay? (콜백), onPlayCapture? (콜백), onPlaying? (콜백), onPlayingCapture? (콜백), onProgress? (콜백), onProgressCapture? (콜백), onRateChange? (콜백), onRateChangeCapture? (콜백), onSeeked? (콜백), onSeekedCapture? (콜백), onSeeking? (콜백), onSeekingCapture? (콜백), onStalled? (콜백), onStalledCapture? (콜백), onSuspend? (콜백), onSuspendCapture? (콜백), onTimeUpdate? (콜백), onTimeUpdateCapture? (콜백), onVolumeChange? (콜백), onVolumeChangeCapture? (콜백), onWaiting? (콜백), onWaitingCapture? (콜백), onAuxClick? (콜백), onAuxClickCapture? (콜백), onClick? (콜백), onClickCapture? (콜백), onContextMenu? (콜백), onContextMenuCapture? (콜백), onDoubleClick? (콜백), onDoubleClickCapture? (콜백), onDrag? (콜백), onDragCapture? (콜백), onDragEnd? (콜백), onDragEndCapture? (콜백), onDragEnter? (콜백), onDragEnterCapture? (콜백), onDragExit? (콜백), onDragExitCapture? (콜백), onDragLeave? (콜백), onDragLeaveCapture? (콜백), onDragOver? (콜백), onDragOverCapture? (콜백), onDragStart? (콜백), onDragStartCapture? (콜백), onDrop? (콜백), onDropCapture? (콜백), onMouseDown? (콜백), onMouseDownCapture? (콜백), onMouseEnter? (콜백), onMouseLeave? (콜백), onMouseMove? (콜백), onMouseMoveCapture? (콜백), onMouseOut? (콜백), onMouseOutCapture? (콜백), onMouseOver? (콜백), onMouseOverCapture? (콜백), onMouseUp? (콜백), onMouseUpCapture? (콜백), onSelectCapture? (콜백), onTouchCancel? (콜백), onTouchCancelCapture? (콜백), onTouchEnd? (콜백), onTouchEndCapture? (콜백), onTouchMove? (콜백), onTouchMoveCapture? (콜백), onTouchStart? (콜백), onTouchStartCapture? (콜백), onPointerDown? (콜백), onPointerDownCapture? (콜백), onPointerMove? (콜백), onPointerMoveCapture? (콜백), onPointerUp? (콜백), onPointerUpCapture? (콜백), onPointerCancel? (콜백), onPointerCancelCapture? (콜백), onPointerEnter? (콜백), onPointerLeave? (콜백), onPointerOver? (콜백), onPointerOverCapture? (콜백), onPointerOut? (콜백), onPointerOutCapture? (콜백), onGotPointerCapture? (콜백), onGotPointerCaptureCapture? (콜백), onLostPointerCapture? (콜백), onLostPointerCaptureCapture? (콜백), onScroll? (콜백), onScrollCapture? (콜백), onScrollEnd? (콜백), onScrollEndCapture? (콜백), onWheel? (콜백), onWheelCapture? (콜백), onAnimationStart? (콜백), onAnimationStartCapture? (콜백), onAnimationEnd? (콜백), onAnimationEndCapture? (콜백), onAnimationIteration? (콜백), onAnimationIterationCapture? (콜백), onToggle? (콜백), onBeforeToggle? (콜백), onTransitionCancel? (콜백), onTransitionCancelCapture? (콜백), onTransitionEnd? (콜백), onTransitionEndCapture? (콜백), onTransitionRun? (콜백), onTransitionRunCapture? (콜백), onTransitionStart? (콜백), onTransitionStartCapture? (콜백) | props / UI 상태 |
| [LoginForm](../src/components/login/LoginForm/LoginForm.tsx) | `LoginFormProps` | mode?, onSwitch? (콜백) | props / UI 상태 |
| [LoginHeading](../src/components/login/LoginHeading/LoginHeading.tsx) | `LoginHeadingProps` | signingUp? | props / UI 상태 |
| [LoginLayout](../src/components/login/LoginLayout/LoginLayout.tsx) | `LoginLayoutProps` | onSignIn? (콜백), onSignUp? (콜백) | props / UI 상태 |
| [LoginSkeleton](../src/components/login/LoginSkeleton/LoginSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [LoginSubmitButton](../src/components/login/LoginSubmitButton/LoginSubmitButton.tsx) | `LoginSubmitButtonProps` | pending?, label?, pendingLabel? | props / UI 상태 |
| [LoginView](../src/components/login/LoginView.tsx) | `LoginViewProps` | onEvent? (콜백), onSignIn? (콜백), onSignUp? (콜백) | props / UI 상태 |
| [PasswordField](../src/components/login/PasswordField/PasswordField.tsx) | `PasswordFieldProps` | error?, list?, form?, multiple?, onSelect? (콜백), label, dir?, nonce?, title?, lang?, max?, min?, name?, id, accept?, alt?, autoComplete?, capture?, checked?, disabled?, formAction?, formEncType?, formMethod?, formNoValidate?, formTarget?, height?, maxLength?, minLength?, pattern?, placeholder?, readOnly?, required?, size?, src?, step?, value?, width?, onChange? (콜백), defaultChecked?, defaultValue?, suppressContentEditableWarning?, suppressHydrationWarning?, accessKey?, autoCapitalize?, autoFocus?, className?, contentEditable?, contextMenu?, draggable?, enterKeyHint?, hidden?, slot?, spellCheck?, style?, tabIndex?, translate?, radioGroup?, role?, about?, content?, datatype?, inlist?, prefix?, property?, rel?, resource?, rev?, typeof?, vocab?, autoCorrect?, autoSave?, color?, itemProp?, itemScope?, itemType?, itemID?, itemRef?, results?, security?, unselectable?, popover?, popoverTargetAction?, popoverTarget?, inert?, inputMode?, is?, exportparts?, part?, tw?, aria-activedescendant?, aria-atomic?, aria-autocomplete?, aria-braillelabel?, aria-brailleroledescription?, aria-busy?, aria-checked?, aria-colcount?, aria-colindex?, aria-colindextext?, aria-colspan?, aria-controls?, aria-current?, aria-describedby?, aria-description?, aria-details?, aria-disabled?, aria-dropeffect?, aria-errormessage?, aria-expanded?, aria-flowto?, aria-grabbed?, aria-haspopup?, aria-hidden?, aria-invalid?, aria-keyshortcuts?, aria-label?, aria-labelledby?, aria-level?, aria-live?, aria-modal?, aria-multiline?, aria-multiselectable?, aria-orientation?, aria-owns?, aria-placeholder?, aria-posinset?, aria-pressed?, aria-readonly?, aria-relevant?, aria-required?, aria-roledescription?, aria-rowcount?, aria-rowindex?, aria-rowindextext?, aria-rowspan?, aria-selected?, aria-setsize?, aria-sort?, aria-valuemax?, aria-valuemin?, aria-valuenow?, aria-valuetext?, children?, dangerouslySetInnerHTML?, onCopy? (콜백), onCopyCapture? (콜백), onCut? (콜백), onCutCapture? (콜백), onPaste? (콜백), onPasteCapture? (콜백), onCompositionEnd? (콜백), onCompositionEndCapture? (콜백), onCompositionStart? (콜백), onCompositionStartCapture? (콜백), onCompositionUpdate? (콜백), onCompositionUpdateCapture? (콜백), onFocus? (콜백), onFocusCapture? (콜백), onBlur? (콜백), onBlurCapture? (콜백), onChangeCapture? (콜백), onBeforeInput? (콜백), onBeforeInputCapture? (콜백), onInput? (콜백), onInputCapture? (콜백), onReset? (콜백), onResetCapture? (콜백), onSubmit? (콜백), onSubmitCapture? (콜백), onInvalid? (콜백), onInvalidCapture? (콜백), onLoad? (콜백), onLoadCapture? (콜백), onError? (콜백), onErrorCapture? (콜백), onKeyDown? (콜백), onKeyDownCapture? (콜백), onKeyPress? (콜백), onKeyPressCapture? (콜백), onKeyUp? (콜백), onKeyUpCapture? (콜백), onAbort? (콜백), onAbortCapture? (콜백), onCanPlay? (콜백), onCanPlayCapture? (콜백), onCanPlayThrough? (콜백), onCanPlayThroughCapture? (콜백), onDurationChange? (콜백), onDurationChangeCapture? (콜백), onEmptied? (콜백), onEmptiedCapture? (콜백), onEncrypted? (콜백), onEncryptedCapture? (콜백), onEnded? (콜백), onEndedCapture? (콜백), onLoadedData? (콜백), onLoadedDataCapture? (콜백), onLoadedMetadata? (콜백), onLoadedMetadataCapture? (콜백), onLoadStart? (콜백), onLoadStartCapture? (콜백), onPause? (콜백), onPauseCapture? (콜백), onPlay? (콜백), onPlayCapture? (콜백), onPlaying? (콜백), onPlayingCapture? (콜백), onProgress? (콜백), onProgressCapture? (콜백), onRateChange? (콜백), onRateChangeCapture? (콜백), onSeeked? (콜백), onSeekedCapture? (콜백), onSeeking? (콜백), onSeekingCapture? (콜백), onStalled? (콜백), onStalledCapture? (콜백), onSuspend? (콜백), onSuspendCapture? (콜백), onTimeUpdate? (콜백), onTimeUpdateCapture? (콜백), onVolumeChange? (콜백), onVolumeChangeCapture? (콜백), onWaiting? (콜백), onWaitingCapture? (콜백), onAuxClick? (콜백), onAuxClickCapture? (콜백), onClick? (콜백), onClickCapture? (콜백), onContextMenu? (콜백), onContextMenuCapture? (콜백), onDoubleClick? (콜백), onDoubleClickCapture? (콜백), onDrag? (콜백), onDragCapture? (콜백), onDragEnd? (콜백), onDragEndCapture? (콜백), onDragEnter? (콜백), onDragEnterCapture? (콜백), onDragExit? (콜백), onDragExitCapture? (콜백), onDragLeave? (콜백), onDragLeaveCapture? (콜백), onDragOver? (콜백), onDragOverCapture? (콜백), onDragStart? (콜백), onDragStartCapture? (콜백), onDrop? (콜백), onDropCapture? (콜백), onMouseDown? (콜백), onMouseDownCapture? (콜백), onMouseEnter? (콜백), onMouseLeave? (콜백), onMouseMove? (콜백), onMouseMoveCapture? (콜백), onMouseOut? (콜백), onMouseOutCapture? (콜백), onMouseOver? (콜백), onMouseOverCapture? (콜백), onMouseUp? (콜백), onMouseUpCapture? (콜백), onSelectCapture? (콜백), onTouchCancel? (콜백), onTouchCancelCapture? (콜백), onTouchEnd? (콜백), onTouchEndCapture? (콜백), onTouchMove? (콜백), onTouchMoveCapture? (콜백), onTouchStart? (콜백), onTouchStartCapture? (콜백), onPointerDown? (콜백), onPointerDownCapture? (콜백), onPointerMove? (콜백), onPointerMoveCapture? (콜백), onPointerUp? (콜백), onPointerUpCapture? (콜백), onPointerCancel? (콜백), onPointerCancelCapture? (콜백), onPointerEnter? (콜백), onPointerLeave? (콜백), onPointerOver? (콜백), onPointerOverCapture? (콜백), onPointerOut? (콜백), onPointerOutCapture? (콜백), onGotPointerCapture? (콜백), onGotPointerCaptureCapture? (콜백), onLostPointerCapture? (콜백), onLostPointerCaptureCapture? (콜백), onScroll? (콜백), onScrollCapture? (콜백), onScrollEnd? (콜백), onScrollEndCapture? (콜백), onWheel? (콜백), onWheelCapture? (콜백), onAnimationStart? (콜백), onAnimationStartCapture? (콜백), onAnimationEnd? (콜백), onAnimationEndCapture? (콜백), onAnimationIteration? (콜백), onAnimationIterationCapture? (콜백), onToggle? (콜백), onBeforeToggle? (콜백), onTransitionCancel? (콜백), onTransitionCancelCapture? (콜백), onTransitionEnd? (콜백), onTransitionEndCapture? (콜백), onTransitionRun? (콜백), onTransitionRunCapture? (콜백), onTransitionStart? (콜백), onTransitionStartCapture? (콜백) | props / UI 상태 |
| [AccountCard](../src/components/mypage/AccountCard/AccountCard.tsx) | `AccountCardProps` | edit?, profile, providerLabel | props / UI 상태 |
| [BusinessConditionsCard](../src/components/mypage/BusinessConditionsCard/BusinessConditionsCard.tsx) | `BusinessConditionsCardProps` | draft, edit?, answers? | props / UI 상태 |
| [DataManagementCard](../src/components/mypage/DataManagementCard/DataManagementCard.tsx) | `DataManagementCardProps` | canReset? | props / UI 상태 |
| [MypagePage](../src/components/mypage/MypagePage/MypagePage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [MypageView](../src/components/mypage/MypageView.tsx) | `MypageViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백), setup? | props / UI 상태 |
| [ProfileBooleanField](../src/components/mypage/ProfileBooleanField/ProfileBooleanField.tsx) | `ProfileBooleanFieldProps` | field, value, onChange? (콜백) | props / UI 상태 |
| [ProfileField](../src/components/mypage/ProfileField/ProfileField.tsx) | `ProfileFieldProps` | field, value, edit? | props / UI 상태 |
| [ProfileFieldEditor](../src/components/mypage/ProfileFieldEditor/ProfileFieldEditor.tsx) | `ProfileFieldEditorProps` | edit | props / UI 상태 |
| [ProfileHeader](../src/components/mypage/ProfileHeader/ProfileHeader.tsx) | 없음 | 없음 | props / UI 상태 |
| [ProfileSetupNotice](../src/components/mypage/ProfileSetupNotice/ProfileSetupNotice.tsx) | 없음 | 없음 | props / UI 상태 |
| [ProfileSkeleton](../src/components/mypage/ProfileSkeleton/ProfileSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [StoreDetailsCard](../src/components/mypage/StoreDetailsCard/StoreDetailsCard.tsx) | `StoreDetailsCardProps` | draft, edit? | props / UI 상태 |
| [StoreResetDialog](../src/components/mypage/StoreResetDialog/StoreResetDialog.tsx) | 없음 | 없음 | props / UI 상태 |
| [AccountActions](../src/components/navigation/AccountActions/AccountActions.tsx) | `AccountActionsProps` | storeName, notifications, notificationFetch?, onOpenNotification (콜백), onOpenStore (콜백), onLogout (콜백) | props / UI 상태 |
| [Logo](../src/components/navigation/Logo/Logo.tsx) | `LogoProps` | onHome (콜백) | props / UI 상태 |
| [LogoutButton](../src/components/navigation/LogoutButton/LogoutButton.tsx) | `LogoutButtonProps` | onLogout (콜백) | props / UI 상태 |
| [Navbar](../src/components/navigation/Navbar/Navbar.tsx) | `NavbarProps` | onNavigate (콜백), onOpenNotification (콜백), onLogout (콜백), currentPage, storeName, notifications, notificationFetch?, destinations?, onboarded? | props / UI 상태 |
| [NavbarSkeleton](../src/components/navigation/NavbarSkeleton/NavbarSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [NavDropdown](../src/components/navigation/NavDropdown/NavDropdown.tsx) | `NavDropdownProps` | label, destinations, currentPage, onNavigate (콜백) | props / UI 상태 |
| [NavDropdownIcon](../src/components/navigation/NavDropdownIcon/NavDropdownIcon.tsx) | `NavDropdownIconProps` | destinationId | props / UI 상태 |
| [NavDropdownItem](../src/components/navigation/NavDropdownItem/NavDropdownItem.tsx) | `NavDropdownItemProps` | destination, active, onNavigate (콜백) | props / UI 상태 |
| [NavDropdownTrigger](../src/components/navigation/NavDropdownTrigger/NavDropdownTrigger.tsx) | `NavDropdownTriggerProps` | label, active, open, panelId, buttonRef, onToggle (콜백), onKeyDown (콜백) | props / UI 상태 |
| [NavItem](../src/components/navigation/NavItem/NavItem.tsx) | `NavItemProps` | destination, active, onNavigate (콜백) | props / UI 상태 |
| [NavLinks](../src/components/navigation/NavLinks/NavLinks.tsx) | `NavLinksProps` | currentPage, onNavigate (콜백), className?, destinations? | props / UI 상태 |
| [NotificationButton](../src/components/navigation/NotificationButton/NotificationButton.tsx) | `NotificationButtonProps` | unread, countKnown?, open, panelId, buttonRef, onToggle (콜백), onKeyDown (콜백) | props / UI 상태 |
| [NotificationCategoryBadge](../src/components/navigation/NotificationCategoryBadge/NotificationCategoryBadge.tsx) | `NotificationCategoryBadgeProps` | category | props / UI 상태 |
| [NotificationItem](../src/components/navigation/NotificationItem/NotificationItem.tsx) | `NotificationItemProps` | notification, onOpen (콜백) | props / UI 상태 |
| [NotificationMenu](../src/components/navigation/NotificationMenu/NotificationMenu.tsx) | `NotificationMenuProps` | notifications, notificationFetch?, onOpen (콜백) | props / UI 상태 |
| [NotificationPopover](../src/components/navigation/NotificationPopover/NotificationPopover.tsx) | `NotificationPopoverProps` | id, panelRef, notifications, notificationFetch?, position, onOpen (콜백), onMouseEnter (콜백), onMouseLeave (콜백) | props / UI 상태 |
| [StoreIdentity](../src/components/navigation/StoreIdentity/StoreIdentity.tsx) | `StoreIdentityProps` | name, onOpen (콜백) | props / UI 상태 |
| [AnalysisStep](../src/components/onboarding/AnalysisStep/AnalysisStep.tsx) | `AnalysisStepProps` | storeName, steps, completed, finished?, notes? | props / UI 상태 |
| [BusinessQuestion](../src/components/onboarding/BusinessQuestion/BusinessQuestion.tsx) | `BusinessQuestionProps` | field, title, description, value | props / UI 상태 |
| [BusinessQuestionsStep](../src/components/onboarding/BusinessQuestionsStep/BusinessQuestionsStep.tsx) | `BusinessQuestionsStepProps` | store, answers?, analysisFailed? | props / UI 상태 |
| [DemoScenarioBanner](../src/components/onboarding/DemoScenarioBanner/DemoScenarioBanner.tsx) | 없음 | 없음 | props / UI 상태 |
| [OnboardingHeader](../src/components/onboarding/OnboardingHeader/OnboardingHeader.tsx) | `OnboardingHeaderProps` | returning, userName | props / UI 상태 |
| [OnboardingPage](../src/components/onboarding/OnboardingPage/OnboardingPage.tsx) | `OnboardingPageProps` | embedded? | Page / Connected 어댑터 |
| [OnboardingView](../src/components/onboarding/OnboardingView.tsx) | `OnboardingViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백), embedded? | props / UI 상태 |
| [RegistrationSkeleton](../src/components/onboarding/RegistrationSkeleton/RegistrationSkeleton.tsx) | `RegistrationSkeletonProps` | currentStep?, analysisCount?, embedded? | props / UI 상태 |
| [StoreAddressFields](../src/components/onboarding/StoreAddressFields/StoreAddressFields.tsx) | `StoreAddressFieldsProps` | store | props / UI 상태 |
| [StoreIdentityFields](../src/components/onboarding/StoreIdentityFields/StoreIdentityFields.tsx) | `StoreIdentityFieldsProps` | store | props / UI 상태 |
| [StoreInformationForm](../src/components/onboarding/StoreInformationForm/StoreInformationForm.tsx) | `StoreInformationFormProps` | store, saving? | props / UI 상태 |
| [StoreInformationStep](../src/components/onboarding/StoreInformationStep/StoreInformationStep.tsx) | `StoreInformationStepProps` | store, saving?, showDemo? | props / UI 상태 |
| [StoreScheduleFields](../src/components/onboarding/StoreScheduleFields/StoreScheduleFields.tsx) | `StoreScheduleFieldsProps` | store | props / UI 상태 |
| [WizardProgress](../src/components/onboarding/WizardProgress/WizardProgress.tsx) | `WizardProgressProps` | step | props / UI 상태 |
| [WizardStep](../src/components/onboarding/WizardStep/WizardStep.tsx) | `WizardStepProps` | number, label, current, complete | props / UI 상태 |
| [EvidenceDialog](../src/components/report/EvidenceDialog/EvidenceDialog.tsx) | `EvidenceDialogProps` | items, date? | props / UI 상태 |
| [EvidenceItem](../src/components/report/EvidenceItem/EvidenceItem.tsx) | `EvidenceItemProps` | item, date? | props / UI 상태 |
| [LockedReport](../src/components/report/LockedReport/LockedReport.tsx) | 없음 | 없음 | props / UI 상태 |
| [NextStepItem](../src/components/report/NextStepItem/NextStepItem.tsx) | `NextStepItemProps` | step | props / UI 상태 |
| [OptionCard](../src/components/report/OptionCard/OptionCard.tsx) | `OptionCardProps` | cardId, option, recommended | props / UI 상태 |
| [OptionConfirmDialog](../src/components/report/OptionConfirmDialog/OptionConfirmDialog.tsx) | `OptionConfirmDialogProps` | cardId, optionId, label, summary, changes, recommended, reason?, meta | props / UI 상태 |
| [ReportCard](../src/components/report/ReportCard/ReportCard.tsx) | `ReportCardProps` | model, expanded?, onExpandedChange? (콜백) | props / UI 상태 |
| [ReportCardActions](../src/components/report/ReportCardActions/ReportCardActions.tsx) | `ReportCardActionsProps` | cardId | props / UI 상태 |
| [ReportCardSummary](../src/components/report/ReportCardSummary/ReportCardSummary.tsx) | `ReportCardSummaryProps` | card, state, verdict, followUpPending | props / UI 상태 |
| [ReportChoiceDialog](../src/components/report/ReportChoiceDialog/ReportChoiceDialog.tsx) | `ReportChoiceDialogProps` | card | props / UI 상태 |
| [ReportChoiceSummary](../src/components/report/ReportChoiceSummary/ReportChoiceSummary.tsx) | `ReportChoiceSummaryProps` | cardId, completedTask | props / UI 상태 |
| [ReportDialogActions](../src/components/report/ReportDialogActions/ReportDialogActions.tsx) | `ReportDialogActionsProps` | content | props / UI 상태 |
| [ReportFilters](../src/components/report/ReportFilters/ReportFilters.tsx) | `ReportFiltersProps` | selected | props / UI 상태 |
| [ReportFollowUp](../src/components/report/ReportFollowUp/ReportFollowUp.tsx) | `ReportFollowUpProps` | model | props / UI 상태 |
| [ReportHeader](../src/components/report/ReportHeader/ReportHeader.tsx) | `ReportHeaderProps` | locked | props / UI 상태 |
| [ReportItems](../src/components/report/ReportItems/ReportItems.tsx) | `ReportItemsProps` | cards | props / UI 상태 |
| [ReportNextSteps](../src/components/report/ReportNextSteps/ReportNextSteps.tsx) | `ReportNextStepsProps` | model | props / UI 상태 |
| [ReportOptions](../src/components/report/ReportOptions/ReportOptions.tsx) | `ReportOptionsProps` | card, state, actionTitle?, nextStep? | props / UI 상태 |
| [ReportPage](../src/components/report/ReportPage/ReportPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [ReportRationale](../src/components/report/ReportRationale/ReportRationale.tsx) | `ReportRationaleProps` | reason | props / UI 상태 |
| [ReportResultDialog](../src/components/report/ReportResultDialog/ReportResultDialog.tsx) | `ReportResultDialogProps` | model | props / UI 상태 |
| [ReportSkeleton](../src/components/report/ReportSkeleton/ReportSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [ReportStepButton](../src/components/report/ReportStepButton/ReportStepButton.tsx) | `ReportStepButtonProps` | cardId, task, kind | props / UI 상태 |
| [ReportSummary](../src/components/report/ReportSummary/ReportSummary.tsx) | `ReportSummaryProps` | counts, firstByVerdict | props / UI 상태 |
| [ReportView](../src/components/report/ReportView.tsx) | `ReportViewProps` | onEvent? (콜백), data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [VerdictBadge](../src/components/report/VerdictBadge/VerdictBadge.tsx) | `VerdictBadgeProps` | verdict, label? | props / UI 상태 |
| [CompetitionCard](../src/components/sites/CompetitionCard/CompetitionCard.tsx) | `CompetitionCardProps` | analysis | props / UI 상태 |
| [FieldChecklistCard](../src/components/sites/FieldChecklistCard/FieldChecklistCard.tsx) | `FieldChecklistCardProps` | onOpenReport? (콜백) | props / UI 상태 |
| [LocationPickDialog](../src/components/sites/LocationPickDialog/LocationPickDialog.tsx) | `LocationPickDialogProps` | areaId | props / UI 상태 |
| [MarketAnalysisPanel](../src/components/sites/MarketAnalysisPanel/MarketAnalysisPanel.tsx) | `MarketAnalysisPanelProps` | open, onClose (콜백), center, radius, category, onCategoryChange (콜백), summary, population, shops, planning | props / UI 상태 |
| [MarketBar](../src/components/sites/MarketBar/MarketBar.tsx) | `MarketBarProps` | label, value, percent | props / UI 상태 |
| [MarketCategoryFilter](../src/components/sites/MarketCategoryFilter/MarketCategoryFilter.tsx) | `MarketCategoryFilterProps` | value, onChange (콜백) | props / UI 상태 |
| [MarketEmptyState](../src/components/sites/MarketEmptyState/MarketEmptyState.tsx) | `MarketEmptyStateProps` | status?, onRetry? (콜백) | props / UI 상태 |
| [MarketMetric](../src/components/sites/MarketMetric/MarketMetric.tsx) | `MarketMetricProps` | label, children, unavailable? | props / UI 상태 |
| [MarketPanelCard](../src/components/sites/MarketPanelCard/MarketPanelCard.tsx) | `MarketPanelCardProps` | title, description?, children | props / UI 상태 |
| [MarketPanelHeader](../src/components/sites/MarketPanelHeader/MarketPanelHeader.tsx) | `MarketPanelHeaderProps` | center, radius, onClose (콜백) | props / UI 상태 |
| [MarketPanelTabs](../src/components/sites/MarketPanelTabs/MarketPanelTabs.tsx) | `MarketPanelTabsProps` | value, onChange (콜백) | props / UI 상태 |
| [MarketSummaryCard](../src/components/sites/MarketSummaryCard/MarketSummaryCard.tsx) | `MarketSummaryCardProps` | analysis, status?, truncated?, onRetry? (콜백) | props / UI 상태 |
| [NearbyShopsCard](../src/components/sites/NearbyShopsCard/NearbyShopsCard.tsx) | `NearbyShopsCardProps` | shops, status?, truncated?, onRetry? (콜백), selectedShop?, onSelect (콜백) | props / UI 상태 |
| [PopulationBreakdownCard](../src/components/sites/PopulationBreakdownCard/PopulationBreakdownCard.tsx) | `PopulationBreakdownCardProps` | title, description, rows, chart | props / UI 상태 |
| [PopulationDataNote](../src/components/sites/PopulationDataNote/PopulationDataNote.tsx) | `PopulationDataNoteProps` | date | props / UI 상태 |
| [PopulationHourlyCard](../src/components/sites/PopulationHourlyCard/PopulationHourlyCard.tsx) | `PopulationHourlyCardProps` | points, hour, onHourChange (콜백) | props / UI 상태 |
| [PopulationReport](../src/components/sites/PopulationReport/PopulationReport.tsx) | `PopulationReportProps` | data?, loading?, error?, retry? (콜백), hour, onHourChange (콜백) | props / UI 상태 |
| [PopulationSummaryCard](../src/components/sites/PopulationSummaryCard/PopulationSummaryCard.tsx) | `PopulationSummaryCardProps` | data?, loading?, error?, onRetry? (콜백) | props / UI 상태 |
| [SelectedShop](../src/components/sites/SelectedShop/SelectedShop.tsx) | `SelectedShopProps` | shop? | props / UI 상태 |
| [ShopListItem](../src/components/sites/ShopListItem/ShopListItem.tsx) | `ShopListItemProps` | shop, selected, onSelect (콜백) | props / UI 상태 |
| [SitesPage](../src/components/sites/SitesPage/SitesPage.tsx) | 없음 | 없음 | Page / Connected 어댑터 |
| [SitesSkeleton](../src/components/sites/SitesSkeleton/SitesSkeleton.tsx) | 없음 | 없음 | props / UI 상태 |
| [SitesView](../src/components/sites/SitesView.tsx) | `SitesViewProps` | data?, loading?, error?, onRetry? (콜백), appKey?, nearbyShopsSource? (콜백), footTrafficData?, footTrafficSource?, footTrafficLoading?, footTrafficError?, onFootTrafficRetry? (콜백), populationData?, populationSource?, populationInsights?, onAnalysisChange? (콜백), onOpenReport? (콜백) | props / UI 상태 |
| [SitesWorkspace](../src/components/sites/SitesWorkspace/SitesWorkspace.tsx) | `SitesWorkspaceProps` | data, appKey?, nearbyShopsSource? (콜백), footTrafficData?, footTrafficSource?, footTrafficLoading?, footTrafficError?, onFootTrafficRetry? (콜백), populationData?, populationSource?, populationInsights?, onAnalysisChange? (콜백), onOpenReport? (콜백) | props / UI 상태 |
| [StrategyCard](../src/components/sites/StrategyCard/StrategyCard.tsx) | 없음 | 없음 | props / UI 상태 |
| [StrategyRow](../src/components/sites/StrategyRow/StrategyRow.tsx) | `StrategyRowProps` | text, source | props / UI 상태 |
| [AddressSearchButton](../src/components/ui/AddressSearchButton/AddressSearchButton.tsx) | `AddressSearchButtonProps` | onSelect (콜백) | props / UI 상태 |
| [Calendar](../src/components/ui/Calendar/Calendar.tsx) | `CalendarProps` | mode?, required?, className?, classNames?, modifiersClassNames?, style?, styles?, modifiersStyles?, id?, defaultMonth?, month?, numberOfMonths?, startMonth?, fromDate?, fromMonth?, fromYear?, endMonth?, toDate?, toMonth?, toYear?, pagedNavigation?, reverseMonths?, hideNavigation?, disableNavigation?, captionLayout?, reverseYears?, navLayout?, fixedWeeks?, hideWeekdays?, showOutsideDays?, showWeekNumber?, animate?, broadcastCalendar?, ISOWeek?, timeZone?, noonSafe?, components?, footer?, autoFocus?, initialFocus?, disabled?, hidden?, today?, modifiers?, labels?, formatters?, dir?, aria-label?, aria-labelledby?, role?, nonce?, title?, lang?, locale?, numerals?, weekStartsOn?, firstWeekContainsDate?, useAdditionalWeekYearTokens?, useAdditionalDayOfYearTokens?, onMonthChange? (콜백), onNextClick? (콜백), onPrevClick? (콜백), onWeekNumberClick?, onDayClick? (콜백), onDayFocus? (콜백), onDayBlur? (콜백), onDayKeyDown? (콜백), onDayMouseEnter? (콜백), onDayMouseLeave? (콜백), dateLib?, onDayKeyUp? (콜백), onDayKeyPress? (콜백), onDayPointerEnter? (콜백), onDayPointerLeave? (콜백), onDayTouchCancel? (콜백), onDayTouchEnd? (콜백), onDayTouchMove? (콜백), onDayTouchStart? (콜백) | props / UI 상태 |
| [DatePickerField](../src/components/ui/DatePickerField/DatePickerField.tsx) | `DatePickerFieldProps` | id, label, value, required?, name?, onValueChange? (콜백) | props / UI 상태 |
| [Input](../src/components/ui/Input/Input.tsx) | `InputProps` | React HTML 속성 | props / UI 상태 |
| [Select](../src/components/ui/Select/Select.tsx) | `SelectProps` | React HTML 속성 | props / UI 상태 |
| [ShiningText](../src/components/ui/ShiningText/ShiningText.tsx) | `ShiningTextProps` | text, className? | props / UI 상태 |
| [Textarea](../src/components/ui/Textarea/Textarea.tsx) | `TextareaProps` | React HTML 속성 | props / UI 상태 |
| [TypewriterText](../src/components/ui/TypewriterText/TypewriterText.tsx) | `TypewriterTextProps` | texts, paused?, typingMs?, deletingMs?, holdMs?, className?, cursorClassName?, accessibleText? | props / UI 상태 |
| [Element](../src/components/view/Element/Element.tsx) | `ElementProps` | React HTML 속성 | props / UI 상태 |
| [EventBoundary](../src/components/view/EventBoundary/EventBoundary.tsx) | `EventBoundaryProps` | children, onEvent? (콜백) | props / UI 상태 |
| [FeatureView](../src/components/view/FeatureView/FeatureView.tsx) | `FeatureViewProps` | page, children, onEvent? (콜백) | props / UI 상태 |
