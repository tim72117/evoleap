package store

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

// LessonAccess 是一課的存取方式(已套用這門課的預設)與這門課要求的最低方案。
type LessonAccess struct {
	Access Access
	// Tier 是這一課要求的最低方案(訂閱的課才有,例如 basic、advanced);單元有寫就用單元的,否則是這門課的
	Tier   string
	Status string
}

// LessonAccessOf 回傳一課的存取方式。lessonID 是空字串時只看這門課(Status 是空的)。
// 課程不存在回 ErrCourseNotFound,課程在但這一課不存在回 ErrLessonFileNotFound。
func (s *Store) LessonAccessOf(ctx context.Context, courseID, lessonID string) (LessonAccess, error) {
	db := s.db.WithContext(ctx)
	var c courseRow
	if err := db.First(&c, "id = ?", courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return LessonAccess{}, ErrCourseNotFound
		}
		return LessonAccess{}, err
	}
	if lessonID == "" {
		return LessonAccess{Access: Access(c.Access), Tier: c.Tier}, nil
	}
	var l lessonRow
	if err := db.First(&l, "course_id = ? AND id = ?", courseID, lessonID).Error; err != nil {
		return LessonAccess{}, notFoundAs(err)
	}
	var u unitRow
	if err := db.First(&u, "course_id = ? AND id = ?", courseID, l.UnitID).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return LessonAccess{}, err
	}
	return LessonAccess{Access: effectiveAccess(l.Access, string(effectiveAccess(u.Access, c.Access))), Tier: effectiveTier(u.Tier, c.Tier), Status: l.Status}, nil
}
