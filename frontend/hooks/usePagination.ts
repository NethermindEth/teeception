import { useMemo } from 'react'

export const DOTS = '...'

interface UsePaginationProps {
  totalCount: number
  pageSize: number
  siblingCount?: number
  currentPage: number // Expected to be zero-based
}

export const usePagination = ({
  totalCount,
  pageSize,
  siblingCount = 1,
  currentPage,
}: UsePaginationProps) => {
  const paginationRange = useMemo(() => {
    // Convert currentPage to zero-based for internal calculations
    const totalPageCount = Math.ceil(totalCount / pageSize)
    const totalPageNumbers = siblingCount + 5

    if (totalPageNumbers >= totalPageCount) {
      return range(0, totalPageCount - 1)
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 0)
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPageCount - 1)

    const shouldShowLeftDots = leftSiblingIndex > 1
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2

    const firstPageIndex = 0
    const lastPageIndex = totalPageCount - 1

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount
      const leftRange = range(0, leftItemCount - 1)

      return [...leftRange, DOTS, lastPageIndex]
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount
      const rightRange = range(totalPageCount - rightItemCount, totalPageCount - 1)
      return [firstPageIndex, DOTS, ...rightRange]
    }

    if (shouldShowLeftDots && shouldShowRightDots) {
      const middleRange = range(leftSiblingIndex, rightSiblingIndex)
      return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex]
    }

    return []
  }, [totalCount, pageSize, siblingCount, currentPage])

  return paginationRange
}

const range = (start: number, end: number) => {
  const length = end - start + 1
  return Array.from({ length }, (_, idx) => idx + start)
}
