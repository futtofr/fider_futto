import "./Roadmap.page.scss"

import React, { useMemo } from "react"
import { Post, Tag, PostStatus } from "@fider/models"
import { Header, ShowPostStatus } from "@fider/components"
import { VStack } from "@fider/components/layout"
import { Trans } from "@lingui/react/macro"

export interface RoadmapPageProps {
  posts: Post[]
  tags: Tag[]
  countPerStatus: { [key: string]: number }
}

interface GroupedPosts {
  [status: string]: Post[]
}

const RoadmapSection: React.FC<{ status: PostStatus; posts: Post[]; count: number; tags: Tag[] }> = ({ status, posts, count, tags }) => {
  if (count === 0) {
    return null
  }

  const truncateDescription = (text: string, maxLength: number = 150): string => {
    const plainText = text.replace(/[#*`\[\]]/g, "")
    if (plainText.length <= maxLength) return plainText
    return plainText.substring(0, maxLength) + "..."
  }

  return (
    <div className="c-roadmap-section">
      <div className="c-roadmap-section__header">
        <h2 className="c-roadmap-section__title">
          <ShowPostStatus status={status} />
        </h2>
        <span className="c-roadmap-section__count">{count}</span>
      </div>

      <div className="c-roadmap-section__posts">
        {posts.map((post) => (
          <a key={post.id} href={`/posts/${post.number}/${post.slug}`} className="c-roadmap-card">
            <div className="c-roadmap-card__header">
              <h3 className="c-roadmap-card__title">{post.title}</h3>
              {post.votesCount > 0 && (
                <div className="c-roadmap-card__votes">
                  <span className="c-roadmap-card__votes-count">{post.votesCount}</span>
                </div>
              )}
            </div>
            {post.description && (
              <p className="c-roadmap-card__description">{truncateDescription(post.description)}</p>
            )}
            <div className="c-roadmap-card__footer">
              {post.tags && post.tags.length > 0 && (
                <div className="c-roadmap-card__tags">
                  {post.tags.slice(0, 3).map((tagSlug) => {
                    const tag = tags.find((t: Tag) => t.slug === tagSlug)
                    return tag ? (
                      <span key={tag.slug} className="c-roadmap-card__tag" style={{ backgroundColor: `${tag.color}15`, color: tag.color }}>
                        {tag.name}
                      </span>
                    ) : null
                  })}
                  {post.tags.length > 3 && <span className="c-roadmap-card__tag-more">+{post.tags.length - 3}</span>}
                </div>
              )}
              {post.commentsCount > 0 && (
                <div className="c-roadmap-card__comments">
                  <span>{post.commentsCount} {post.commentsCount === 1 ? "comment" : "comments"}</span>
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

const RoadmapPage = (props: RoadmapPageProps) => {
  // Group posts by status
  const groupedPosts: GroupedPosts = useMemo(() => {
    const groups: GroupedPosts = {}

    // Initialize all statuses
    PostStatus.All.forEach((status) => {
      groups[status.value] = []
    })

    // Group posts
    props.posts.forEach((post) => {
      if (post.status !== "deleted" && post.status !== "duplicate") {
        if (!groups[post.status]) {
          groups[post.status] = []
        }
        groups[post.status].push(post)
      }
    })

    // Sort posts within each group by votes (descending)
    Object.keys(groups).forEach((status) => {
      groups[status].sort((a, b) => b.votesCount - a.votesCount)
    })

    return groups
  }, [props.posts])

  // Define the order we want to display statuses for a roadmap
  // Only show: Planned, Started, and Completed (exclude Open, Declined, Duplicate)
  const roadmapStatusOrder = [
    PostStatus.Planned,
    PostStatus.Started,
    PostStatus.Completed,
  ]

  return (
    <>
      <Header />
      <div id="p-roadmap" className="page container">
        <div className="p-roadmap__content">
          <div className="p-roadmap__header">
            <h1 className="p-roadmap__title">
              <Trans id="roadmap.title">Roadmap</Trans>
            </h1>
            <p className="p-roadmap__description">
              <Trans id="roadmap.description">
                See what we're working on, what's planned for the future, and what we've already delivered.
              </Trans>
            </p>
          </div>

          <VStack spacing={4} className="p-roadmap__sections">
            {roadmapStatusOrder.map((status) => (
              <RoadmapSection
                key={status.value}
                status={status}
                posts={groupedPosts[status.value] || []}
                count={props.countPerStatus[status.value] || 0}
                tags={props.tags}
              />
            ))}
          </VStack>
        </div>
      </div>
    </>
  )
}

export default RoadmapPage
