package utils

import (
	"fmt"
	"slices"
)

// LazySortedList maintains a list that can be lazily sorted with a custom
// comparator
type LazySortedList[T any] struct {
	items    []T
	len      int
	needSort bool
}

// NewLazySortedList creates a new LazySortedList
func NewLazySortedList[T any]() *LazySortedList[T] {
	return &LazySortedList[T]{
		items:    make([]T, 0),
		len:      0,
		needSort: false,
	}
}

// Add appends an item to the list and marks it as needing sorting
func (l *LazySortedList[T]) Add(items ...T) {
	l.items = append(l.items, items...)
	l.needSort = true
}

// Sort sorts the list using the provided less function if needed
func (l *LazySortedList[T]) Sort(less func(a, b T) int) {
	if !l.needSort {
		return
	}

	l.len = len(l.items)
	slices.SortFunc(l.items, less)

	l.needSort = false
}

// Get returns the item at the given index
func (l *LazySortedList[T]) Get(index int) (T, bool) {
	if index >= l.len {
		var zero T
		return zero, false
	}

	return l.items[index], true
}

// MustGet returns the item at the given index
func (l *LazySortedList[T]) MustGet(index int) T {
	item, ok := l.Get(index)
	if !ok {
		panic(fmt.Sprintf("index out of bounds: %d", index))
	}
	return item
}

// GetRange returns a slice of items in the given range
func (l *LazySortedList[T]) GetRange(start, end int) ([]T, bool) {
	if start > end || start >= l.len || end > l.len {
		return nil, false
	}

	return l.items[start:end], true
}

// Len returns the current length of the list
func (l *LazySortedList[T]) Len() int {
	return l.len
}

// InnerLen returns the current inner length of the list, which is the length
// considering unsorted items
func (l *LazySortedList[T]) InnerLen() int {
	return len(l.items)
}

// Clear empties the list
func (l *LazySortedList[T]) Clear() {
	l.items = make([]T, 0)
	l.len = 0
	l.needSort = false
}
